import { defineHandler } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async () => SuccessObject.fromData().toResponse(),
})
