import { type EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, getRouterParam, type H3Event, readValidatedBody } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const totpUuid = getRouterParam(event, 'uuid') ?? ''
    assert(isValidUUID(totpUuid), 'Invalid UUID.')
    const body = await readValidatedBody<H3Event, EncryptedTotp>(event, isEncryptedTotp)
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    await bucket.set(totpUuid as UUID, body)
    return SuccessObject.fromData().toResponse(event)
  },
})
