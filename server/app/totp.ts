import type { Storage } from 'unstorage'
import { User } from '~/app/user'

interface StorageObject<K extends string, V> {
  key: K
  value: V
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export class TotpBucket {
  private readonly storage: Storage<EncryptedTotp>

  private constructor(storage: Storage<EncryptedTotp>) {
    this.storage = storage
  }

  static of(user: User) {
    return new TotpBucket(useStorage<EncryptedTotp>(user.id))
  }

  public has(uuid: UUID) {
    return this.storage.hasItem(uuid)
  }

  public get(uuid: UUID) {
    return this.storage.getItem(uuid)
  }

  public async set(uuid: UUID, record: EncryptedTotp) {
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
  }
}
