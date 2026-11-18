import { hasExactlyOneChange, useDatabaseWithMetadata } from '~/utils/db'
import { ensureSchemaUpgrade } from '~/app/database/schema'
import type { User } from '~/app/user'
import { AppError } from '~/app/error'
import { isValidDigits, isValidPeriod } from '~/utils/validation'
import { useStorage } from 'nitro/storage'

export type UUID = `${string}-${string}-${string}-${string}-${string}`
const dayMs = 24 * 60 * 60 * 1000

export interface VaultData {
  active: Record<UUID, EncryptedTotp>
  deleted: Record<UUID, TotpTombstone>
}

/** An isolated candidate revision. The caller publishes all changes together. */
export class VaultEditor {
  public changed = false
  constructor(readonly data: VaultData, readonly limit?: number) {}

  set(uuid: UUID, record: EncryptedTotp) {
    const { active, deleted } = this.data
    if (!active[uuid] && this.limit && Object.keys(active).length >= this.limit) {
      throw new TooManyTotpsError()
    }
    active[uuid] = record
    delete deleted[uuid]
    this.changed = true
  }

  delete(uuid: UUID, deletedAt = Date.now()) {
    delete this.data.active[uuid]
    this.data.deleted[uuid] = { deletedAt }
    this.changed = true
  }

  setAll(records: Record<UUID, EncryptedTotp>) {
    if (this.limit && Object.keys(records).length > this.limit) throw new TooManyTotpsError()
    const now = Date.now()
    for (const key of Object.keys(this.data.active) as UUID[]) {
      if (!(key in records)) this.delete(key, now)
    }
    for (const [key, record] of Object.entries(records)) this.set(key as UUID, record)
  }

  clear(clearDeleted = false) {
    this.setAll({})
    if (clearDeleted) {
      this.data.deleted = {}
      this.changed = true
    }
  }
}

export class TotpBucket {
  private constructor(private readonly userId: string, private readonly limit?: number) {}

  static of(user: User) {
    return new TotpBucket(user.id, user.totpsLimit)
  }

  /** Returns the bucket of the given user identifier, without any limit. */
  static ofUserId(userId: string) {
    return new TotpBucket(userId)
  }

  private get storage() {
    return useStorage(`totps/${this.userId}`)
  }

  private async head(): Promise<string | null> {
    await ensureSchemaUpgrade()
    const row = await useDatabaseWithMetadata().prepare('SELECT revision FROM totpBucketHeads WHERE userId = ?').bind(this.userId).get() as { revision: string } | undefined
    return row?.revision ?? null
  }

  /** Returns the current revision and its data. */
  async snapshot(): Promise<{ revision: string | null, data: VaultData }> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const revision = await this.head()
      if (revision === null) {
        const active = useStorage<EncryptedTotp>(`totps/${this.userId}/totps`)
        const deleted = useStorage<TotpTombstone>(`totps/${this.userId}/deleted`)
        const data: VaultData = {
          active: storageObjectsToRecord(await active.getItems(await active.getKeys())),
          deleted: storageObjectsToRecord(await deleted.getItems(await deleted.getKeys())),
        }
        for (const record of Object.values(data.active)) {
          // Older servers accepted generation parameters outside the generator's range.
          if (!isValidDigits(record.digits)) delete record.digits
          if (!isValidPeriod(record.validity)) delete record.validity
        }
        if (await this.head() === null) return { revision, data }
      }
      else {
        if (revision.startsWith('empty-')) return { revision, data: { active: {}, deleted: {} } }
        const data = await this.storage.getItem<VaultData>(`revisions:${revision}`)
        if (data) return { revision, data: { active: { ...data.active }, deleted: { ...data.deleted } } }
        // An obsolete revision may have just been collected. Never interpret missing data as an empty vault.
        if (await this.head() === revision) break
      }
    }
    throw new AppError('Vault revision temporarily unavailable.', 'vaultUnavailable', 503)
  }

  async read() {
    return (await this.snapshot()).data
  }

  /** Removes the stored data of the given [revision], and the legacy keys. Used once the user has been deleted. */
  async removeStorage(revision: string | null) {
    await this.removeLegacyKeys()
    if (revision && !revision.startsWith('empty-')) await this.storage.removeItem(`revisions:${revision}`)
  }

  private async removeLegacyKeys() {
    const storage = this.storage
    const groups = await Promise.all([storage.getKeys('totps'), storage.getKeys('deleted')])
    await Promise.all(groups.flat().map(key => storage.removeItem(key)))
  }

  /** Re-evaluate timestamp conflicts and quota against the winning revision on contention. */
  async edit<T>(change: (editor: VaultEditor) => T): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { revision, data } = await this.snapshot()
      const editor = new VaultEditor(data, this.limit)
      const result = change(editor)
      if (!editor.changed) return result
      const empty = !Object.keys(data.active).length && !Object.keys(data.deleted).length
      const next = (empty ? 'empty-' : '') + Date.now() + '-' + crypto.randomUUID()
      if (!empty) await this.storage.setItem(`revisions:${next}`, data)
      const db = useDatabaseWithMetadata()
      const published = revision === null
        ? await db.prepare('INSERT OR IGNORE INTO totpBucketHeads (userId, revision) SELECT id, ? FROM users WHERE id = ?').bind(next, this.userId).run()
        : await db.prepare('UPDATE totpBucketHeads SET revision = ? WHERE userId = ? AND revision = ?').bind(next, this.userId, revision).run()
      if (!published.success) throw new AppError('Could not publish vault revision.', 'vaultUnavailable', 503)
      if (hasExactlyOneChange(published)) {
        // Publication is durable. The scheduled prune retries interrupted cleanup.
        try {
          if (revision === null) await this.removeLegacyKeys()
          else if (!revision.startsWith('empty-')) await this.storage.removeItem(`revisions:${revision}`)
        }
        catch (error) {
          console.warn('Vault revision cleanup deferred.', error)
        }
        return result
      }
      if (!empty) await this.storage.removeItem(`revisions:${next}`)
    }
    throw new AppError('Concurrent vault update. Please retry.', 'vaultBusy', 503)
  }

  static async pruneDeletedTotps(days = 365) {
    const keys = await useStorage('totps').getKeys()
    const cutoff = Date.now() - days * dayMs
    const users = new Set(keys.map(key => key.split(':')[0]!))
    for (const userId of users) {
      const bucket = new TotpBucket(userId)
      const user = await useDatabaseWithMetadata().prepare('SELECT id FROM users WHERE id = ?').bind(userId).get()
      if (user) await bucket.edit((editor) => {
        for (const [key, tombstone] of Object.entries(editor.data.deleted)) {
          if (tombstone.deletedAt < cutoff) {
            delete editor.data.deleted[key as UUID]
            editor.changed = true
          }
        }
      })
      // Reclaim abandoned publications only after any in-flight writer has finished.
      const revisions = await bucket.storage.getKeys('revisions')
      const head = await bucket.head()
      if (head || !user) await bucket.removeLegacyKeys()
      for (const key of revisions) {
        const revision = key.split(':').at(-1)!
        if (revision !== head && Number(revision.split('-')[0]) < Date.now() - 7 * dayMs) await bucket.storage.removeItem(key)
      }
    }
  }
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
  label?: Uint8Array
  issuer?: Uint8Array
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
