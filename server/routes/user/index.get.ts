import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit()],
  handler: async (event: H3Event) => {
    const user = await useUser(event)
    return SuccessObject.fromData(user.toJson())
  },
})
