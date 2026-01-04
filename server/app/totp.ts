import type { Storage } from 'unstorage'
import { User } from '~/app/user'
import { AppError } from '~/app/error'

interface StorageObject<K extends string, V> {
  key: K
  value: V
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export class TotpBucket {
  private readonly storage: Storage<EncryptedTotp>
  private readonly limit: number

  private constructor(storage: Storage<EncryptedTotp>, limit: number) {
    this.storage = storage
    this.limit = limit
  }

  static of(user: User) {
    return new TotpBucket(useStorage<EncryptedTotp>(user.id), user.contributorPlan ? backendConfig.totpsLimit.contributor : backendConfig.totpsLimit.default)
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
      if (keys.length >= this.limit) {
        throw new TooManyTotpsError()
      }
    }
    await this.storage.setItem(uuid, record)
  }

  public async delete(uuid: UUID) {
    await this.storage.removeItem(uuid)
  }

  public async getAll() {
    const uuids = await this.storage.getKeys()
    return this.storageObjectsToRecord(await this.storage.getItems(uuids))
  }

  public async setAll(record: Record<UUID, EncryptedTotp>) {
    const existingKeys = await this.storage.getKeys()
    const keysToSet = Object.keys(record)
    const intersection = [...existingKeys].filter(keysToSet.includes).length
    const newKeys = keysToSet.length - intersection
    if (existingKeys.length + newKeys > this.limit) {
      throw new TooManyTotpsError()
    }
    await this.storage.setItems(this.recordToStorageObjects(record))
  }

  public async clear() {
    await this.storage.clear()
  }

  private recordToStorageObjects(record: Record<UUID, EncryptedTotp>): StorageObject<string, EncryptedTotp>[] {
    const keys = Object.keys(record)
    return keys.map((key) => {
      return {
        key,
        value: record[key as UUID],
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
