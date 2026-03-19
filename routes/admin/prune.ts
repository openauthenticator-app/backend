import { Session, TotpBucket } from '~/app'
import { defineHandler, type H3Event, readBody } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const body = await readBody<{ days: number | undefined }>(event)
  if (!body) {
    return ErrorObject.validationError()
  }
  await TotpBucket.pruneAccounts(body.days)
  await Session.pruneExpired()
  await TotpBucket.pruneDeletedTotps(body.days)
  return SuccessObject.fromData()
})
