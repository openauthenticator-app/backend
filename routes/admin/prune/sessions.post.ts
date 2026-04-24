import { Session } from '~/app'
import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
  await Session.pruneExpired()
  return SuccessObject.fromData().toResponse(event)
})
