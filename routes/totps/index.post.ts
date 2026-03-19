import { type EncryptedTotp, TotpBucket, type UserEvent } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown) => {
  if (!body || typeof body !== 'object') {
    return false
  }
  for (const uuid in body) {
    if (!isValidUUID(uuid)) {
      return false
    }
    // @ts-expect-error Expected any here.
    const encryptedTotp = body[uuid]
    if (!isEncryptedTotp(encryptedTotp)) {
      return false
    }
  }
  return true
}

export default defineHandler({
  middleware: [rateLimit({ limit: 5 })],
  handler: async (event: H3Event) => {
    const body = await readValidatedBody<H3Event, Record<string, EncryptedTotp>>(event, validateBody)
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    await bucket.setAll(body)
    return SuccessObject.fromData()
  },
})
