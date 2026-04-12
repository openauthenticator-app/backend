import { useStorage } from 'nitro/storage'
import { createUnstorageStore, getClientIP, rateLimiter } from '~/app'
import type { H3Event, Middleware } from 'nitro/h3'

export const buildScopedRateLimitKey = (
  clientIp: string,
  pathname: string,
  ...identifiers: Array<string | null | undefined>
) => {
  const normalizedIdentifiers = identifiers
    .map(identifier => identifier?.trim().toLowerCase())
    .filter((identifier): identifier is string => !!identifier)

  return [clientIp, pathname, ...normalizedIdentifiers].join(':')
}

const defaultKeyGenerator = (event: H3Event) => buildScopedRateLimitKey(getClientIP(event), event.url.pathname)

export const rateLimit = (
  options: {
    limit?: number | ((event: H3Event) => number | Promise<number>)
    windowMs?: number
    keyGenerator?: (event: H3Event) => string | Promise<string>
  } = {
    limit: 20,
  },
): Middleware => backendConfig.rateLimiter.enable
  ? rateLimiter({
      ...options,
      store: createUnstorageStore({
        storage: useStorage('rateLimiter'),
      }),
      keyGenerator: options.keyGenerator ?? defaultKeyGenerator,
    })
  : () => {}
