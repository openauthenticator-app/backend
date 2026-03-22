import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit({ limit: 1 })],
  handler: async (event: H3Event) => {
    const user = await useUser(event)
    await user.deleteFromDatabase({ deleteSessions: true, deleteTotps: true })
    return SuccessObject.fromData().toResponse()
  },
})
