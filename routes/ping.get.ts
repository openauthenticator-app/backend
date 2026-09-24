import { rateLimit } from '~/utils/ratelimit'
import { SuccessObject } from '~/utils/utils'
import { defineHandler } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: event => SuccessObject.fromData().toResponse(event),
})
