import type { AppEvent, EmailProvider } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    if (!['email'].includes(authProvider.id)) {
      throw createError({
        status: 404,
        message: `Cannot find any route matching [${event.node.req.method}] ${event.path}`,
      })
    }
    await (authProvider as EmailProvider).cancel(event as AppEvent)
    return SuccessObject.fromData()
  },
})
