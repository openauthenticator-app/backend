import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const user = await useUser(event)
    return SuccessObject.fromData(user.toJson())
  },
})
