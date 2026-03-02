import { TotpBucket, type UserEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit({ limit: 5 })],
  handler: async (event: H3Event) => {
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    return SuccessObject.fromData(await bucket.getAll())
  },
})
