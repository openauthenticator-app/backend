import { checkRateLimit, type RateLimitAlgorithm, type RateLimitInfo, } from '~/app/ratelimiter/limit'
import type { RateLimitStore } from '~/app/ratelimiter/stores/store'
import { MemoryStore } from '~/app/ratelimiter/stores/memory'
import { eventHandler, type EventHandler, getRequestIP, H3Event } from 'nitro/h3'
import { AppError } from '~/app/error'

export type RateLimitOptions = {
  limit?: number | ((event: H3Event) => number | Promise<number>)
  windowMs?: number
  algorithm?: RateLimitAlgorithm
  store?: RateLimitStore
  keyGenerator?: (event: H3Event) => string | Promise<string>
  handler?: (event: H3Event, info: RateLimitInfo) => void | Promise<void>
  skip?: (event: H3Event) => boolean | Promise<boolean>
  onRateLimited?: (event: H3Event, info: RateLimitInfo) => void | Promise<void>
  onStoreError?: 'allow' | 'deny' | ((error: Error, event: H3Event) => boolean | Promise<boolean>)
  dryRun?: boolean
}

let defaultStore: RateLimitStore | undefined

export function shutdownDefaultStore(): void {
  if (defaultStore) {
    defaultStore.shutdown()
    defaultStore = undefined
  }
}

export function getClientIP(event: H3Event): string {
  const ip = getRequestIP(event, { xForwardedFor: true })
  if (ip) {
    return ip
  }

  const cfIP = event.req.headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP
  }

  const xRealIP = event.req.headers.get('x-real-ip')
  if (xRealIP) {
    return xRealIP
  }

  const xff = event.req.headers.get('x-forwarded-for')
  if (xff) {
    const xffValue = xff.split(',')[0]?.trim()
    if (xffValue) {
      return xffValue
    }
  }

  return 'unknown'
}

export function rateLimiter(options?: RateLimitOptions): EventHandler {
  const opts = {
    limit: 100 as number | ((event: H3Event) => number | Promise<number>),
    windowMs: 60_000,
    algorithm: 'sliding-window' as RateLimitAlgorithm,
    store: undefined as RateLimitStore | undefined,
    keyGenerator: getClientIP,
    handler: undefined as
      | ((event: H3Event, info: RateLimitInfo) => void | Promise<void>)
      | undefined,
    skip: undefined as ((event: H3Event) => boolean | Promise<boolean>) | undefined,
    onRateLimited: undefined as
      | ((event: H3Event, info: RateLimitInfo) => void | Promise<void>)
      | undefined,
    onStoreError: 'allow' as
    | 'allow'
    | 'deny'
    | ((error: Error, event: H3Event) => boolean | Promise<boolean>),
    dryRun: false,
    ...options,
  }

  assert(!(typeof opts.limit === 'number' && opts.limit <= 0), 'Limit must be a positive number.')
  assert(opts.windowMs > 0, 'windowMs must be a positive number.')

  const store = opts.store ?? (defaultStore ??= new MemoryStore())

  let initPromise: Promise<void> | null = null

  async function handleStoreError(error: Error, event: H3Event): Promise<boolean> {
    if (typeof opts.onStoreError === 'function') {
      return opts.onStoreError(error, event)
    }
    return opts.onStoreError === 'allow'
  }

  return eventHandler(async (event: H3Event) => {
    if (!initPromise && store.init) {
      const result = store.init(opts.windowMs)
      initPromise = result instanceof Promise ? result : Promise.resolve()
    }
    if (initPromise) {
      try {
        await initPromise
      }
      catch (error) {
        const shouldAllow = await handleStoreError(
          error instanceof Error ? error : new Error(String(error)),
          event,
        )
        if (!shouldAllow) {
          throw new RateLimiterInitializationError()
        }
        return
      }
    }

    if (opts.skip) {
      const shouldSkip = await opts.skip(event)
      if (shouldSkip) {
        return
      }
    }

    let allowed: boolean
    let info: RateLimitInfo

    try {
      const result = await checkRateLimit({
        store,
        key: await opts.keyGenerator(event),
        limit: typeof opts.limit === 'function' ? await opts.limit(event) : opts.limit,
        windowMs: opts.windowMs,
        algorithm: opts.algorithm,
      })
      allowed = result.allowed
      info = result.info
    }
    catch (error) {
      const shouldAllow = await handleStoreError(
        error instanceof Error ? error : new Error(String(error)),
        event,
      )
      if (!shouldAllow) {
        throw new RateLimiterGenericError()
      }
      return
    }

    event.res.headers.set('X-RateLimit-Limit', info.limit.toString())
    event.res.headers.set('X-RateLimit-Remaining', info.remaining.toString())
    event.res.headers.set('X-RateLimit-Reset', Math.ceil(info.reset / 1000).toString())

    event.context.rateLimit = info

    if (!allowed) {
      if (opts.onRateLimited) {
        await opts.onRateLimited(event, info)
      }

      if (!opts.dryRun) {
        event.res.headers.set('Retry-After', Math.ceil((info.reset - Date.now()) / 1000).toString())

        if (opts.handler) {
          await opts.handler(event, info)
          return
        }

        throw new RateLimitExceededError()
      }
    }
  })
}

class RateLimiterGenericError extends AppError {
  constructor() {
    super('Rate limiter error.', RateLimiterGenericError, 500)
  }
}

class RateLimiterInitializationError extends AppError {
  constructor() {
    super('Rate limiter initialization failed.', RateLimiterInitializationError, 500)
  }
}

class RateLimitExceededError extends AppError {
  constructor() {
    super('Rate limit exceeded.', RateLimitExceededError, 429)
  }
}
