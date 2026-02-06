import { Session, TotpBucket } from '~/app'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ days: number | undefined }>(event)
  await TotpBucket.pruneAccounts(body.days)
  await Session.pruneExpired()
  await TotpBucket.pruneDeletedTotps(body.days)
  return SuccessObject.fromData()
})
