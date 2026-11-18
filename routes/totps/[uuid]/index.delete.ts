import { rateLimit } from '~/utils/ratelimit'
import { assert } from '~/utils/assert'
import { SuccessObject } from '~/utils/response'
import { isValidUUID } from '~/utils/validation'
import { TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, getRouterParam, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const totpUuid = getRouterParam(event, 'uuid')!
    assert(isValidUUID(totpUuid), 'Invalid UUID.')
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    await bucket.edit((vault) => {
      if (vault.data.active[totpUuid as UUID]) vault.delete(totpUuid as UUID)
    })
    return SuccessObject.fromData().toResponse(event)
  },
})
