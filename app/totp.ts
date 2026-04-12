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
  private readonly deletedStorage: Storage<DeletedTotp>
  private readonly limit: number | undefined

  private constructor(
    storage: Storage<EncryptedTotp>,
    deletedStorage: Storage<DeletedTotp>,
    limit?: number,
  ) {
    this.storage = storage
    this.deletedStorage = deletedStorage
    this.limit = limit
  }

  static of(user: User) {
    return new TotpBucket(useStorage<EncryptedTotp>(`totps/${user.id}/totps`), useStorage<DeletedTotp>(`totps/${user.id}/deleted`), user.totpsLimit)
  }

  static async pruneDeletedTotps(days?: number) {
    const storage = useStorage('totps')
    const users = await storage.getKeys()
    for (const user of users) {
      const bucket = new TotpBucket(useStorage<EncryptedTotp>(`totps/${user}/totps`), useStorage<DeletedTotp>(`totps/${user}/deleted`))
      await bucket.prune(days)
    }
  }

  static async pruneInactiveAccounts(days?: number) {
    const db = useDatabaseWithMetadata()
    const ids = (await db.prepare('SELECT * FROM users WHERE contributorPlan = 0')
      .all()) as { id: string }[]
    for (const { id } of ids) {
      const sessions = (await db.prepare('SELECT sessionId FROM sessions WHERE userId = ? AND expiration > ?')
        .bind(id, Date.now() + (days ?? 0) * 24 * 60 * 60 * 1000)
        .all()) as { sessionId: string }[]
      if (sessions.length > 0) {
        continue
      }
      const bucket = new TotpBucket(useStorage<EncryptedTotp>(`totps/${id}/totps`), useStorage<DeletedTotp>(`totps/${id}/deleted`))
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
  }

  public async delete(uuid: UUID) {
    await this.storage.removeItem(uuid)
    await this.deletedStorage.setItem(uuid, { timestamp: Date.now() })
  }

  public async getAll() {
    const uuids = await this.storage.getKeys()
    return this.storageObjectsToRecord(await this.storage.getItems(uuids))
  }

  public async setAll(record: Record<UUID, EncryptedTotp>) {
    const existingKeys = await this.storage.getKeys()
    const keysToSet = Object.keys(record)
    if (this.limit) {
      const intersection = [...existingKeys].filter(keysToSet.includes).length
      const newKeys = keysToSet.length - intersection
      if (existingKeys.length + newKeys > this.limit) {
        throw new TooManyTotpsError()
      }
    }
    await this.storage.setItems(this.recordToStorageObjects(record))
    const deletedKeys = existingKeys.filter(key => !keysToSet.includes(key))
    await this.deletedStorage.setItems(this.keysToDeletedObjects(deletedKeys))
  }

  public async clear(clearDeleted = false) {
    const existingKeys = await this.storage.getKeys()
    await this.storage.clear()
    if (clearDeleted) {
      await this.deletedStorage.clear()
    }
    else {
      await this.deletedStorage.setItems(this.keysToDeletedObjects(existingKeys))
    }
  }

  public async getDeleted(): Promise<Record<UUID, DeletedTotp>> {
    const result: Record<UUID, DeletedTotp> = {}
    const uuids = await this.deletedStorage.getKeys()
    for (const uuid of uuids) {
      result[uuid as UUID] = (await this.deletedStorage.getItem(uuid))!
    }
    return result
  }

  private async prune(days?: number) {
    const now = Date.now()
    const deletedKeys = await this.deletedStorage.getKeys()
    if (!days) {
      await this.deletedStorage.clear()
      return
    }

    for (const key of deletedKeys) {
      const deleted = (await this.deletedStorage.getItem(key))!
      if (now - deleted.timestamp > days * 24 * 60 * 60 * 1000) {
        await this.deletedStorage.removeItem(key)
      }
    }
  }

  private keysToDeletedObjects(keys: string[]) {
    return keys.map(key => ({ key, value: { timestamp: Date.now() } }))
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

export interface DeletedTotp {
  timestamp: number
}

export class EncryptedTotp {
  public readonly algorithm?: Algorithm
  public readonly digits?: number
  public readonly validity?: number
  public readonly encryptionSalt: Uint8Array
  public readonly secret: Uint8Array
  public readonly label: Uint8Array
  public readonly issuer: Uint8Array
  public readonly imageUrl?: Uint8Array
  public readonly updatedAt: number

  private constructor(
    options: {
      algorithm?: Algorithm
      digits?: number
      validity?: number
      encryptionSalt: Uint8Array
      secret: Uint8Array
      label: Uint8Array
      issuer: Uint8Array
      imageUrl?: Uint8Array
      updatedAt: number
    },
  ) {
    this.algorithm = options.algorithm
    this.digits = options.digits
    this.validity = options.validity
    this.encryptionSalt = options.encryptionSalt
    this.secret = options.secret
    this.label = options.label
    this.issuer = options.issuer
    this.imageUrl = options.imageUrl
    this.updatedAt = options.updatedAt
  }
}

class TooManyTotpsError extends AppError {
  constructor() {
    super('Too many TOTPs.', TooManyTotpsError, 403)
  }
}
