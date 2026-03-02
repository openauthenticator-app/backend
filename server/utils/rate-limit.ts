import { getClientIP, rateLimiter } from '@jfungus/ratelimit-h3'
import { createUnstorageStore } from '@jfungus/ratelimit-unstorage'
import { AppError } from '~/app'
import type { EventHandler, H3Event } from 'h3'

export const rateLimit = (
  options: {
    limit?: number | ((event: H3Event) => number | Promise<number>)
    windowMs?: number
  } = {
    limit: 20,
  },
): EventHandler => backendConfig.rateLimiter.enable
  ? rateLimiter({
      ...options,
      store: createUnstorageStore({
        storage: useStorage('rateLimiter'),
      }),
      keyGenerator: event => event.context.appClientId ?? getClientIP(event),
      handler: () => {
        throw new RateLimitExceededError()
      },
    })
  : () => {}

class RateLimitExceededError extends AppError {
  constructor() {
    super('Rate limit exceeded.', RateLimitExceededError, 429)
  }
}
