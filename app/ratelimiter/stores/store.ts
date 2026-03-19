export interface StoreResult {
  count: number
  reset: number
}

export abstract class RateLimitStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public init(_windowMs: number): void | Promise<void> {}
  public abstract increment(key: string): StoreResult | Promise<StoreResult>
  public abstract decrement(key: string): void | Promise<void>
  public abstract resetKey(key: string): void | Promise<void>
  public abstract resetAll(): void | Promise<void>
  public abstract get(key: string): Promise<StoreResult | undefined> | StoreResult | undefined
  public shutdown(): void | Promise<void> {}
}
