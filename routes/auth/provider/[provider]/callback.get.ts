import type { AppEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    event.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    event.res.headers.set('Pragma', 'no-cache')
    event.res.headers.set('Expires', '0')
    const authProvider = useAuthProvider(event)
    return redirectIntoApp(event, (await authProvider.callback(event as AppEvent)).toString())
  },
})
