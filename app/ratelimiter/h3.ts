import backendConfig from '~/backend.config'
import { checkRateLimit, type RateLimitAlgorithm } from '~/app/ratelimiter/limit'
import { RateLimitStore } from '~/app/ratelimiter/store'
import { getRequestIP, type H3Event, type Middleware } from 'nitro/h3'
import type { Storage } from 'unstorage'
import { AppError } from '~/app/error'

export interface RateLimitOptions {
  limit: number | ((event: H3Event) => number | Promise<number>)
  windowMs: number
  algorithm: RateLimitAlgorithm
  storage: Storage
  keyGenerator: (event: H3Event) => string | Promise<string>
}

/**
 * Returns the client IP address.
 * By default, only the address provided by the runtime is trusted (ie. the socket address on Node.js, `CF-Connecting-IP`
 * on Cloudflare). If the backend is behind a reverse proxy, `rateLimiter.trustedIpHeader` should be configured.
 */
export function getClientIP(event: H3Event): string {
  const header = backendConfig.rateLimiter.trustedIpHeader
  if (header) {
    // When multiple values are present, the last one is the one appended by the trusted proxy.
    const value = event.req.headers.get(header)?.split(',').at(-1)?.trim()
    if (value) {
      return value
    }
  }
  return getRequestIP(event) ?? 'unknown'
}

export function rateLimiter(options: RateLimitOptions): Middleware {
  const store = new RateLimitStore(options.storage, options.windowMs)
  return async (event: H3Event) => {
    let allowed: boolean
    try {
      const limit = typeof options.limit === 'function' ? await options.limit(event) : options.limit
      const result = await checkRateLimit(store, await options.keyGenerator(event), limit, options.windowMs, options.algorithm)
      allowed = result.allowed
      event.res.headers.set('X-RateLimit-Limit', result.info.limit.toString())
      event.res.headers.set('X-RateLimit-Remaining', result.info.remaining.toString())
      event.res.headers.set('X-RateLimit-Reset', Math.ceil(result.info.reset / 1000).toString())
      if (!allowed) {
        event.res.headers.set('Retry-After', Math.ceil((result.info.reset - Date.now()) / 1000).toString())
      }
    }
    catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      // Fail open if the store is unavailable.
      console.error('Rate limiter error :', error)
      return
    }
    if (!allowed) {
      throw new RateLimitExceededError()
    }
  }
}

class RateLimitExceededError extends AppError {
  constructor() {
    super('Rate limit exceeded.', RateLimitExceededError, 429)
  }
}
