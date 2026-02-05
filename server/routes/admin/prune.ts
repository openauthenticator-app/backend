import { Session, TotpBucket } from '~/app'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ days: number | undefined }>(event)
  await Session.pruneExpired()
  await TotpBucket.pruneDeleted(body.days)
  return SuccessObject.fromData()
})
