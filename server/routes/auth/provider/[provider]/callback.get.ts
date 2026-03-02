import type { AppEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    return redirectIntoApp(event, (await authProvider.callback(event as AppEvent)).toString())
  },
})
