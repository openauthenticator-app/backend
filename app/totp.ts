import type { Storage } from 'unstorage'
import { User } from '~/app/user'
import { AppError } from '~/app/error'
import { useStorage } from 'nitro/storage'

interface StorageObject<K extends string, V> {
  key: K
  value: V
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export class TotpBucket {
  private readonly storage: Storage<EncryptedTotp>
  private readonly deletedStorage: Storage<TotpTombstone>
  private readonly limit: number | undefined

  private constructor(
    storage: Storage<EncryptedTotp>,
    deletedStorage: Storage<TotpTombstone>,
    limit?: number,
  ) {
    this.storage = storage
    this.deletedStorage = deletedStorage
    this.limit = limit
  }

  static of(user: User) {
    return new TotpBucket(useStorage<EncryptedTotp>(`totps/${user.id}/totps`), useStorage<TotpTombstone>(`totps/${user.id}/deleted`), user.totpsLimit)
  }

  static async pruneDeletedTotps(days?: number) {
    const storage = useStorage('totps')
    const users = await storage.getKeys()
    for (const user of users) {
      const bucket = new TotpBucket(useStorage<EncryptedTotp>(`totps/${user}/totps`), useStorage<TotpTombstone>(`totps/${user}/deleted`))
      await bucket.prune(days)
    }
  }

  static async pruneInactiveAccounts(days?: number) {
    const db = useDatabaseWithMetadata()
    const ids = (await db.prepare('SELECT * FROM users WHERE contributorPlan = 0')
      .all()) as { id: string }[]
    const cutoff = Date.now() - (days ?? 0) * 24 * 60 * 60 * 1000
    for (const { id } of ids) {
      const sessions = (await db.prepare('SELECT sessionId FROM sessions WHERE userId = ? AND expiration > ?')
        .bind(id, cutoff)
        .all()) as { sessionId: string }[]
      if (sessions.length > 0) {
        continue
      }
      const bucket = new TotpBucket(useStorage<EncryptedTotp>(`totps/${id}/totps`), useStorage<TotpTombstone>(`totps/${id}/deleted`))
      const keys = await bucket.storage.getKeys()
      if (keys.length > 0) {
        continue
      }
      await bucket.clear(true)
      await db.prepare('DELETE FROM users WHERE id = ?')
        .bind(id)
        .run()
      await db.prepare('DELETE FROM sessions WHERE userId = ?')
        .bind(id)
        .run()
      await db.prepare('DELETE FROM emailVerifications WHERE userId = ?')
        .bind(id)
        .run()
    }
  }

  public has(uuid: UUID) {
    return this.storage.hasItem(uuid)
  }

  public get(uuid: UUID) {
    return this.storage.getItem(uuid)
  }

  public async set(uuid: UUID, record: EncryptedTotp) {
    const add = !await this.storage.hasItem(uuid)
    if (add) {
      const keys = await this.storage.getKeys()
      if (this.limit && keys.length >= this.limit) {
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

  public async getAll() {
    const uuids = await this.storage.getKeys()
    return this.storageObjectsToRecord(await this.storage.getItems(uuids))
  }

  public async setAll(record: Record<UUID, EncryptedTotp>, bypassLimit: boolean = false) {
    const existingKeys = await this.storage.getKeys()
    const keysToSet = Object.keys(record)
    if (this.limit && !bypassLimit) {
      const intersection = [...existingKeys].filter(keysToSet.includes).length
      const newKeys = keysToSet.length - intersection
      if (existingKeys.length + newKeys > this.limit) {
        throw new TooManyTotpsError()
      }
    }
    await this.storage.setItems(this.recordToStorageObjects(record))
    const deletedKeys = existingKeys.filter(key => !keysToSet.includes(key))
    await Promise.all(deletedKeys.map(key => this.storage.removeItem(key)))
    await this.deletedStorage.setItems(this.keysToTombstonesStorageObjects(deletedKeys))
    await Promise.all(keysToSet.map(key => this.deletedStorage.removeItem(key)))
  }

  public async clear(clearDeleted = false) {
    const existingKeys = await this.storage.getKeys()
    await this.storage.clear()
    if (clearDeleted) {
      await this.deletedStorage.clear()
    }
    else {
      await this.deletedStorage.setItems(this.keysToTombstonesStorageObjects(existingKeys))
    }
  }

  public async getTombstone(uuid: UUID) {
    return this.deletedStorage.get(uuid)
  }

  public async getTombstones(): Promise<Record<UUID, TotpTombstone>> {
    const result: Record<UUID, TotpTombstone> = {}
    const uuids = await this.deletedStorage.getKeys()
    for (const uuid of uuids) {
      result[uuid as UUID] = (await this.deletedStorage.getItem(uuid))!
    }
    return result
  }

  private async prune(days?: number) {
    const now = Date.now()
    const deletedKeys = await this.deletedStorage.getKeys()

    for (const key of deletedKeys) {
      const deleted = (await this.deletedStorage.getItem(key))!
      if (now - deleted.deletedAt > (days ?? 365) * 24 * 60 * 60 * 1000) {
        await this.deletedStorage.removeItem(key)
      }
    }
  }

  private keysToTombstonesStorageObjects(keys: string[]): StorageObject<string, TotpTombstone>[] {
    return keys.map(key => ({ key, value: { deletedAt: Date.now() } }))
  }

  private recordToStorageObjects(record: Record<UUID, EncryptedTotp>): StorageObject<string, EncryptedTotp>[] {
    const keys = Object.keys(record)
    return keys.map((key) => {
      return {
        key,
        value: record[key as UUID]!,
      }
    })
  }

  private storageObjectsToRecord(storageObjects: StorageObject<string, EncryptedTotp>[]) {
    return storageObjects.reduce(
      (record, { key, value }) => {
        record[key as UUID] = value
        return record
      },
      {} as Record<UUID, EncryptedTotp>,
    )
  }
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
    if (typeof a === 'undefined') {
      return typeof b === 'undefined'
    }
    if (typeof b === 'undefined') {
      return false
    }
    if (a.length !== b.length) {
      return false
    }
    return a.every((value, index) => value === b[index])
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

class TooManyTotpsError extends AppError {
  constructor() {
    super('Too many TOTPs.', TooManyTotpsError, 403)
  }
}
