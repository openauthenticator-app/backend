import { type EncryptedTotp, TotpBucket, type UserEvent } from '~/app'
import type { H3Event } from 'h3'

const validateBody = (body: unknown) => {
  if (typeof body !== 'object') {
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

export default defineEventHandler(async (event: H3Event) => {
  const body = await readValidatedBody<Record<string, EncryptedTotp>>(event, validateBody)
  const userEvent = event as UserEvent
  const bucket = TotpBucket.of(userEvent.context.user)
  await bucket.setAll(body)
  return SuccessObject.fromData()
})
