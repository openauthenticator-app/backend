import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit({ limit: 1 })],
  handler: async (event: H3Event) => {
    const user = await useUser(event)
    await user.deleteFromDatabase({ deleteSessions: true, deleteTotps: true })
    return SuccessObject.fromData()
  },
})
