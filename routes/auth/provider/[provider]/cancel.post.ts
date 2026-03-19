import type { AppEvent, EmailProvider } from '~/app'
import { defineHandler, type H3Event, HTTPError } from 'nitro/h3'
import xss from 'xss'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    if (!['email'].includes(authProvider.id)) {
      throw new HTTPError(
        `Cannot find any route matching [${event.req.method}] ${xss(event.url.pathname)}`,
        {
          status: 404,
        },
      )
    }
    await (authProvider as EmailProvider).cancel(event as AppEvent)
    return SuccessObject.fromData()
  },
})
