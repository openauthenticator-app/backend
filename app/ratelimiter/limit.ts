import type { RateLimitStore } from '~/app/ratelimiter/stores/store'

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export type RateLimitAlgorithm = 'fixed-window' | 'sliding-window'

export type CheckRateLimitOptions = {
  store: RateLimitStore
  key: string
  limit: number
  windowMs: number
  algorithm?: RateLimitAlgorithm
}

export type CheckRateLimitResult = {
  allowed: boolean
  info: RateLimitInfo
}

let slidingWindowWarned = false

async function checkSlidingWindow(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
): Promise<CheckRateLimitResult> {
  const now = Date.now()
  const currentWindowStart = Math.floor(now / windowMs) * windowMs
  const previousWindowStart = currentWindowStart - windowMs

  const previousKey = `${key}:${previousWindowStart}`
  const currentKey = `${key}:${currentWindowStart}`

  const current = await store.increment(currentKey)

  let previousCount = 0
  if (store.get) {
    const prev = await store.get(previousKey)
    previousCount = prev?.count ?? 0
  }
  else if (!slidingWindowWarned) {
    slidingWindowWarned = true
    console.warn(
      'Store does not implement get() method. '
      + 'Sliding window algorithm will behave like fixed window. '
      + 'Consider using a store with get() support or switch to \'fixed-window\' algorithm.',
    )
  }

  const elapsedMs = now - currentWindowStart
  const weight = (windowMs - elapsedMs) / windowMs
  const estimatedCount = Math.floor(previousCount * weight) + current.count

  const remaining = Math.max(0, limit - estimatedCount)
  const allowed = estimatedCount <= limit
  const reset = currentWindowStart + windowMs

  return {
    allowed,
    info: { limit, remaining, reset },
  }
}

async function checkFixedWindow(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
): Promise<CheckRateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const windowKey = `${key}:${windowStart}`

  const { count, reset } = await store.increment(windowKey)

  const remaining = Math.max(0, limit - count)
  const allowed = count <= limit

  return {
    allowed,
    info: { limit, remaining, reset },
  }
}

export async function checkRateLimit(
  options: CheckRateLimitOptions,
): Promise<CheckRateLimitResult> {
  const { store, key, limit, windowMs, algorithm = 'sliding-window' } = options

  // Validate
  if (limit <= 0) {
    throw new Error(`[@jfungus/ratelimit] limit must be a positive number, got: ${limit}`)
  }
  if (windowMs <= 0) {
    throw new Error(`[@jfungus/ratelimit] windowMs must be a positive number, got: ${windowMs}`)
  }

  if (algorithm === 'sliding-window') {
    return checkSlidingWindow(store, key, limit, windowMs)
  }
  return checkFixedWindow(store, key, limit, windowMs)
}

export function resetSlidingWindowWarning(): void {
  slidingWindowWarned = false
}
