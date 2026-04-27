import { EmailProvider, RevenueCatWebhookEventStore, Session, TotpBucket } from '~/app'
import { defineHandler, type H3Event, readBody } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const body = await readBody<{ days: number | undefined }>(event)
  await TotpBucket.pruneInactiveAccounts(body?.days)
  await Session.pruneExpired()
  await EmailProvider.pruneExpiredVerifications()
  await TotpBucket.pruneDeletedTotps(body?.days)
  await RevenueCatWebhookEventStore.pruneProcessedEvents(body?.days)
  return SuccessObject.fromData().toResponse(event)
})
