import { type EncryptedTotp, TotpBucket, type User } from '~/app'

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

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody<Record<string, EncryptedTotp>>(event, validateBody)
  const bucket = TotpBucket.of(event.context.user as User)
  await bucket.setAll(body)
  return noError()
})
