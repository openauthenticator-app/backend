import backendConfig from '~/backend.config'
import { useDatabaseWithMetadata } from '~/utils/db'
import type { Storage } from 'unstorage'
import { User } from '~/app/user'
import { AppError } from '~/app/error'
import { useStorage } from 'nitro/storage'

interface StorageObject<K extends string, V> {
  key: K
  value: V
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

const dayMs = 24 * 60 * 60 * 1000

export class TotpBucket {
  private readonly storage: Storage<EncryptedTotp>
  private readonly deletedStorage: Storage<TotpTombstone>
  public readonly limit: number | undefined

  private constructor(userId: string, limit?: number) {
    this.storage = useStorage<EncryptedTotp>(`totps/${userId}/totps`)
    this.deletedStorage = useStorage<TotpTombstone>(`totps/${userId}/deleted`)
    this.limit = limit
  }

  static of(user: User) {
    return new TotpBucket(user.id, user.totpsLimit)
  }

  static async pruneDeletedTotps(days?: number) {
    const storage = useStorage('totps')
    const users = new Set(
      (await storage.getKeys())
        .map(key => key.split(':'))
        .filter((parts): parts is [string, 'deleted', ...string[]] => parts.length >= 3 && parts[1] === 'deleted')
        .map(([user]) => user),
    )

    for (const user of users) {
      await new TotpBucket(user).prune(days)
    }
  }

  static async pruneInactiveAccounts(days?: number) {
    if (backendConfig.authentication.strategy === 'stateless') {
      // Sessions are not stored in the database, so we have no way of knowing whether an account is inactive.
      console.warn('Inactive accounts pruning is not available with the stateless authentication strategy.')
      return
    }
    const db = useDatabaseWithMetadata()
    const cutoff = Date.now() - (days ?? 0) * dayMs
    const users = (await db
      .prepare('SELECT id FROM users WHERE contributorPlan = 0 AND id NOT IN (SELECT userId FROM sessions WHERE expiration > ?)')
      .bind(cutoff)
      .all()) as { id: string }[]
    for (const { id } of users) {
      const bucket = new TotpBucket(id)
      if ((await bucket.storage.getKeys()).length > 0) {
        continue
      }
      await bucket.clear(true)
      await db.prepare('DELETE FROM sessions WHERE userId = ?').bind(id).run()
      await db.prepare('DELETE FROM emailVerifications WHERE userId = ?').bind(id).run()
      await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
    }
  }

  public has(uuid: UUID) {
    return this.storage.hasItem(uuid)
  }

  public get(uuid: UUID) {
    return this.storage.getItem(uuid)
  }

  public async set(uuid: UUID, record: EncryptedTotp, bypassLimit: boolean = false) {
    if (this.limit && !bypassLimit && !await this.storage.hasItem(uuid)) {
      const count = (await this.storage.getKeys()).length
      if (count >= this.limit) {
        throw new TooManyTotpsError()
      }
    }
    await this.storage.setItem(uuid, record)
    await this.deletedStorage.removeItem(uuid)
  }

  public async delete(uuid: UUID, deletedAt?: number) {
    await this.storage.removeItem(uuid)
    await this.deletedStorage.setItem(uuid, { deletedAt: deletedAt ?? Date.now() })
  }

  public async getAll(): Promise<Record<UUID, EncryptedTotp>> {
    const uuids = await this.storage.getKeys()
    return storageObjectsToRecord(await this.storage.getItems(uuids))
  }

  public async setAll(record: Record<UUID, EncryptedTotp>, bypassLimit: boolean = false) {
    const keysToSet = Object.keys(record)
    // The whole bucket is replaced, so only the new keys count toward the limit.
    if (this.limit && !bypassLimit && keysToSet.length > this.limit) {
      throw new TooManyTotpsError()
    }
    const keysToSetSet = new Set(keysToSet)
    const deletedKeys = (await this.storage.getKeys()).filter(key => !keysToSetSet.has(key))
    await this.storage.setItems(keysToSet.map(key => ({ key, value: record[key as UUID]! })))
    await Promise.all(deletedKeys.map(key => this.storage.removeItem(key)))
    await this.deletedStorage.setItems(keysToTombstonesStorageObjects(deletedKeys))
    await Promise.all(keysToSet.map(key => this.deletedStorage.removeItem(key)))
  }

  public async clear(clearDeleted = false) {
    const existingKeys = await this.storage.getKeys()
    await this.storage.clear()
    if (clearDeleted) {
      await this.deletedStorage.clear()
    }
    else {
      await this.deletedStorage.setItems(keysToTombstonesStorageObjects(existingKeys))
    }
  }

  public async getTombstones(): Promise<Record<UUID, TotpTombstone>> {
    const uuids = await this.deletedStorage.getKeys()
    return storageObjectsToRecord(await this.deletedStorage.getItems(uuids))
  }

  private async prune(days?: number) {
    const cutoff = Date.now() - (days ?? 365) * dayMs
    const tombstones = await this.getTombstones()
    await Promise.all(
      Object.entries(tombstones)
        .filter(([, tombstone]) => tombstone.deletedAt < cutoff)
        .map(([key]) => this.deletedStorage.removeItem(key)),
    )
  }
}

const keysToTombstonesStorageObjects = (keys: string[]): StorageObject<string, TotpTombstone>[] => {
  const deletedAt = Date.now()
  return keys.map(key => ({ key, value: { deletedAt } }))
}

const storageObjectsToRecord = <V>(storageObjects: { key: string, value: unknown }[]): Record<UUID, V> => {
  const record: Record<UUID, V> = {}
  for (const { key, value } of storageObjects) {
    if (value !== null && value !== undefined) {
      record[key as UUID] = value as V
    }
  }
  return record
}

export type Algorithm = 'SHA1' | 'SHA256' | 'SHA512'

export interface TotpTombstone {
  deletedAt: number
}

export interface EncryptedTotp {
  algorithm?: Algorithm
  digits?: number
  validity?: number
  encryptionSalt: Uint8Array
  secret: Uint8Array
  label: Uint8Array
  issuer: Uint8Array
  imageUrl?: Uint8Array
  updatedAt: number
}

export const areEncryptedTotpsEqual = (a: EncryptedTotp, b: EncryptedTotp): boolean => {
  const areUint8ArrayEqual = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean => {
    if (a === undefined || b === undefined) {
      return a === b
    }
    return a.length === b.length && a.every((value, index) => value === b[index])
  }
  return a.algorithm === b.algorithm
    && a.digits === b.digits
    && a.validity === b.validity
    && areUint8ArrayEqual(a.encryptionSalt, b.encryptionSalt)
    && areUint8ArrayEqual(a.secret, b.secret)
    && areUint8ArrayEqual(a.label, b.label)
    && areUint8ArrayEqual(a.issuer, b.issuer)
    && areUint8ArrayEqual(a.imageUrl, b.imageUrl)
    && a.updatedAt === b.updatedAt
}

export class TooManyTotpsError extends AppError {
  constructor() {
    super('Too many TOTPs.', TooManyTotpsError, 403)
  }
}
