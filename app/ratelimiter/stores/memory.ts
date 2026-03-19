import { RateLimitStore, type StoreResult } from '~/app/ratelimiter/stores/store'

type MemoryEntry = {
  count: number
  reset: number
}

export class MemoryStore extends RateLimitStore {
  private entries = new Map<string, MemoryEntry>()
  private windowMs = 60_000
  private cleanupTimer?: ReturnType<typeof setInterval>

  public override init(windowMs: number): void {
    this.windowMs = windowMs
    const cleanupInterval = Math.min(Math.max(windowMs, 60_000), 300_000)

    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.entries) {
        if (entry.reset <= now) {
          this.entries.delete(key)
        }
      }
    }, cleanupInterval)

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  public override increment(key: string): StoreResult {
    const now = Date.now()
    const existing = this.entries.get(key)

    if (!existing || existing.reset <= now) {
      const reset = now + this.windowMs
      this.entries.set(key, { count: 1, reset })
      return { count: 1, reset }
    }

    existing.count++
    return { count: existing.count, reset: existing.reset }
  }

  public override get(key: string): StoreResult | undefined {
    const entry = this.entries.get(key)
    if (!entry || entry.reset <= Date.now()) {
      return undefined
    }
    return { count: entry.count, reset: entry.reset }
  }

  public override decrement(key: string): void {
    const entry = this.entries.get(key)
    if (entry && entry.count > 0) {
      entry.count--
    }
  }

  public override resetKey(key: string): void {
    this.entries.delete(key)
  }

  public override resetAll(): void {
    this.entries.clear()
  }

  public override shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.entries.clear()
  }
}
