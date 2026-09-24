import { SuccessObject } from '~/utils/utils'
import { Session } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  await Session.pruneExpired()
  return SuccessObject.fromData().toResponse(event)
})
