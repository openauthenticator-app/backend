import { defineHandler, getRouterParam, type H3Event } from 'nitro/h3'
import { type AppEvent, getClientIP } from '~/app'

export default defineHandler({
  middleware: [
    rateLimit({
      limit: (event: H3Event) => getRouterParam(event, 'provider') === 'email' ? 3 : 20,
      windowMs: 15 * 60 * 1000,
      keyGenerator: (event: H3Event) => {
        const provider = getRouterParam(event, 'provider') ?? 'unknown'
        if (provider !== 'email') {
          return buildScopedRateLimitKey(getClientIP(event), event.url.pathname)
        }
        const email = event.url.searchParams.get('email')?.trim().toLowerCase() ?? 'unknown'
        return buildScopedRateLimitKey(getClientIP(event), event.url.pathname, email)
      },
    }),
  ],
  handler: async (event: H3Event) => {
    event.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    event.res.headers.set('Pragma', 'no-cache')
    event.res.headers.set('Expires', '0')
    const authProvider = useAuthProvider(event)
    return redirectIntoApp(event, (await authProvider.redirect(event as AppEvent)).toString())
  },
})
