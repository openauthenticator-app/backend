import { TotpBucket, type User, type UUID } from '~/app'

export default defineEventHandler(async (event) => {
  const totpUuid = getRouterParam(event, 'uuid')!
  if (!isValidUUID(totpUuid)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid UUID.',
    })
  }
  const bucket = TotpBucket.of(event.context.user as User)
  if (await bucket.has(totpUuid as UUID)) {
    await bucket.delete(totpUuid as UUID)
  }
  return noError()
})
