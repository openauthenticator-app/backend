import { RateLimitStore, type StoreResult } from '~/app/ratelimiter/stores/store'
import { useStorage } from 'nitro/storage'

type Storage = ReturnType<typeof useStorage>

type StoredEntry = {
  count: number
  reset: number
}

export type UnstorageStoreOptions = {
  storage: Storage
  prefix?: string
}

export function createUnstorageStore(options: UnstorageStoreOptions): RateLimitStore {
  const { storage, prefix = 'ratelimit:' } = options
  return new UnstorageStore(storage, prefix)
}

class UnstorageStore extends RateLimitStore {
  private readonly storage: Storage
  private readonly prefix: string
  private windowMs: number

  constructor(storage: Storage, prefix: string, windowMs: number = 60_000) {
    super()
    this.storage = storage
    this.prefix = prefix
    this.windowMs = windowMs
  }

  override init(ms: number): void {
    this.windowMs = ms
  }

  public override async increment(key: string): Promise<StoreResult> {
    const fullKey = this.getKey(key)
    const now = Date.now()

    const existing = await this.storage.getItem<StoredEntry>(fullKey)

    if (existing && existing.reset > now) {
      const updated: StoredEntry = {
        count: existing.count + 1,
        reset: existing.reset,
      }
      await this.storage.setItem(fullKey, updated, {
        ttl: this.getTtlSeconds(),
      })
      return { count: updated.count, reset: updated.reset }
    }

    const reset = now + this.windowMs
    const entry: StoredEntry = { count: 1, reset }
    await this.storage.setItem(fullKey, entry, {
      ttl: this.getTtlSeconds(),
    })
    return { count: 1, reset }
  }

  public override async get(key: string): Promise<StoreResult | undefined> {
    const fullKey = this.getKey(key)
    const entry = await this.storage.getItem<StoredEntry>(fullKey)

    if (!entry || entry.reset <= Date.now()) {
      return undefined
    }

    return { count: entry.count, reset: entry.reset }
  }

  public override async decrement(key: string): Promise<void> {
    const fullKey = this.getKey(key)
    const entry = await this.storage.getItem<StoredEntry>(fullKey)

    if (entry && entry.count > 0) {
      const updated: StoredEntry = {
        count: entry.count - 1,
        reset: entry.reset,
      }
      await this.storage.setItem(fullKey, updated, {
        ttl: this.getTtlSeconds(),
      })
    }
  }

  public override async resetKey(key: string): Promise<void> {
    const fullKey = this.getKey(key)
    await this.storage.removeItem(fullKey)
  }

  public override async resetAll(): Promise<void> {
    const keys = await this.storage.getKeys(this.prefix)
    await Promise.all(keys.map(key => this.storage.removeItem(key)))
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`
  }

  private getTtlSeconds(): number {
    return Math.ceil((this.windowMs * 1.1) / 1000)
  }
}
