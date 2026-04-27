import { EmailProvider } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  await EmailProvider.pruneExpiredVerifications()
  return SuccessObject.fromData().toResponse(event)
})
