import { useStorage } from 'nitro/storage'
import { createUnstorageStore, getClientIP, rateLimiter } from '~/app'
import type { H3Event, Middleware } from 'nitro/h3'

export const rateLimit = (
  options: {
    limit?: number | ((event: H3Event) => number | Promise<number>)
    windowMs?: number
  } = {
    limit: 20,
  },
): Middleware => backendConfig.rateLimiter.enable
  ? rateLimiter({
      ...options,
      store: createUnstorageStore({
        storage: useStorage('rateLimiter'),
      }),
      keyGenerator: event => event.context.appClientId ?? getClientIP(event),
    })
  : () => {}
