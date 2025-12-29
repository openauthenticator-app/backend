import { type EncryptedTotp, TotpBucket, type User, type UUID } from '~/app'

export default defineEventHandler(async (event) => {
  const totpUuid = getRouterParam(event, 'uuid') ?? ''
  if (!isValidUUID(totpUuid)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid UUID.',
    })
  }
  const body = await readValidatedBody<EncryptedTotp>(event, isEncryptedTotp)
  const bucket = TotpBucket.of(event.context.user as User)
  await bucket.set(totpUuid as UUID, body)
  return noError()
})
