import type { Storage } from 'unstorage'

export interface RateLimitEntry {
  count: number
  reset: number
}

/**
 * Stores rate limit counters in an unstorage instance.
 */
export class RateLimitStore {
  private readonly storage: Storage<RateLimitEntry>
  private readonly windowMs: number

  constructor(storage: Storage, windowMs: number) {
    this.storage = storage as Storage<RateLimitEntry>
    this.windowMs = windowMs
  }

  public async increment(key: string): Promise<RateLimitEntry> {
    const now = Date.now()
    const existing = await this.get(key)
    const entry: RateLimitEntry = existing
      ? { count: existing.count + 1, reset: existing.reset }
      : { count: 1, reset: now + this.windowMs }
    await this.storage.setItem(key, entry, { ttl: Math.ceil((this.windowMs * 1.1) / 1000) })
    return entry
  }

  public async get(key: string): Promise<RateLimitEntry | undefined> {
    const entry = await this.storage.getItem(key)
    return entry && entry.reset > Date.now() ? entry : undefined
  }
}
