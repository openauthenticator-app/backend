import { rateLimit } from '~/utils/ratelimit'
import { SuccessObject } from '~/utils/response'
import { isEncryptedTotp, isPlainObject, isValidUUID } from '~/utils/validation'
import { type EncryptedTotp, TotpBucket, type UserEvent } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown) => isPlainObject(body)
  && Object.entries(body).every(([uuid, encryptedTotp]) => isValidUUID(uuid) && isEncryptedTotp(encryptedTotp))

export default defineHandler({
  middleware: [rateLimit({ limit: 5 })],
  handler: async (event: H3Event) => {
    const body = await readValidatedBody<H3Event, Record<string, EncryptedTotp>>(event, validateBody)
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    await bucket.edit(vault => vault.setAll(body))
    return SuccessObject.fromData().toResponse(event)
  },
})
