import type { RateLimitStore } from '~/app/ratelimiter/store'

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export type RateLimitAlgorithm = 'fixed-window' | 'sliding-window'

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  algorithm: RateLimitAlgorithm,
): Promise<{ allowed: boolean, info: RateLimitInfo }> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const current = await store.increment(`${key}:${windowStart}`)

  let count = current.count
  let reset = current.reset
  if (algorithm === 'sliding-window') {
    // Weights the previous window count according to the time elapsed in the current one.
    const previous = await store.get(`${key}:${windowStart - windowMs}`)
    const weight = (windowMs - (now - windowStart)) / windowMs
    count += Math.floor((previous?.count ?? 0) * weight)
    reset = windowStart + windowMs
  }

  return {
    allowed: count <= limit,
    info: { limit, remaining: Math.max(0, limit - count), reset },
  }
}
