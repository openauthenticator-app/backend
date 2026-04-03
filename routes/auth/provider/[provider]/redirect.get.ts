import type { AppEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    event.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    event.res.headers.set('Pragma', 'no-cache')
    const authProvider = useAuthProvider(event)
    return redirectIntoApp((await authProvider.redirect(event as AppEvent)).toString())
  },
})
