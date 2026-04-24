import type { AppEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    return SuccessObject.fromData(await authProvider.link(event as AppEvent)).toResponse(event)
  },
})
