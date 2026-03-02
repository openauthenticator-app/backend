import { type EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit()],
  handler: async (event: H3Event) => {
    const totpUuid = getRouterParam(event, 'uuid') ?? ''
    assert(isValidUUID(totpUuid), 'Invalid UUID.')
    const body = await readValidatedBody<EncryptedTotp>(event, isEncryptedTotp)
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    await bucket.set(totpUuid as UUID, body)
    return SuccessObject.fromData()
  },
})
