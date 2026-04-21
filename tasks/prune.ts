import { RevenueCatWebhookEventStore, Session, TotpBucket } from '~/app'
import { defineTask } from 'nitro/task'

export default defineTask({
  meta: {
    name: 'prune',
    description: 'Prune accounts, sessions, TOTPs, and RevenueCat webhook events.',
  },
  async run() {
    await TotpBucket.pruneInactiveAccounts()
    await Session.pruneExpired()
    await TotpBucket.pruneDeletedTotps()
    await RevenueCatWebhookEventStore.pruneProcessedEvents()
    return SuccessObject.fromData().toResponse()
  },
})
