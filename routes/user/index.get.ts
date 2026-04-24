import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    return SuccessObject.fromData(event.context.user!.toJson()).toResponse(event)
  },
})
