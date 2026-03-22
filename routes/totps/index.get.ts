import { TotpBucket, type UserEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit({ limit: 5 })],
  handler: async (event: H3Event) => {
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    return SuccessObject.fromData(await bucket.getAll()).toResponse()
  },
})
