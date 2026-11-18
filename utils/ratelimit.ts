import backendConfig from '~/backend.config'
import { useStorage } from 'nitro/storage'
import { getClientIP, rateLimiter } from '~/app'
import type { H3Event, Middleware } from 'nitro/h3'

export const buildScopedRateLimitKey = (
  event: H3Event,
  ...identifiers: Array<string | null | undefined>
) => {
  const normalizedIdentifiers = identifiers
    .map(identifier => identifier?.trim().toLowerCase())
    .filter((identifier): identifier is string => !!identifier)

  // Routes sharing the same path (eg. `GET /user` and `DELETE /user`) have different limits, so the method is part of the key.
  return [getClientIP(event), event.req.method, event.url.pathname, ...normalizedIdentifiers].join(':')
}

const defaultKeyGenerator = (event: H3Event) => buildScopedRateLimitKey(event)

export const rateLimit = (
  options: {
    limit?: number | ((event: H3Event) => number | Promise<number>)
    windowMs?: number
    keyGenerator?: (event: H3Event) => string | Promise<string>
  } = {},
): Middleware => backendConfig.rateLimiter.enable
  ? rateLimiter({
      limit: options.limit ?? 20,
      windowMs: options.windowMs ?? 60_000,
      keyGenerator: options.keyGenerator ?? defaultKeyGenerator,
      storage: useStorage('rateLimiter'),
      algorithm: backendConfig.rateLimiter.algorithm,
    })
  : () => {}
