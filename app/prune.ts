import backendConfig from '~/backend.config'
import { hasExactlyOneChange, useDatabaseWithMetadata } from '~/utils/db'
import { EmailProvider } from '~/app/auth/providers/email'
import { Session } from '~/app/auth/session'
import { RevenueCatWebhookEventStore } from '~/app/revenuecat/handler'
import { TotpBucket } from '~/app/totp'

const dayMs = 24 * 60 * 60 * 1000

/** Prunes everything that can be : inactive accounts, expired sessions and verifications, old tombstones and webhook events. */
export async function pruneAll(days?: number) {
  await pruneInactiveAccounts(days)
  await Session.pruneExpired()
  await EmailProvider.pruneExpiredVerifications()
  await TotpBucket.pruneDeletedTotps(days)
  await RevenueCatWebhookEventStore.pruneProcessedEvents(days)
}

/** Deletes the accounts that have no TOTP, no contributor plan and no session active in the last [days] days. */
export async function pruneInactiveAccounts(days?: number) {
  if (backendConfig.authentication.strategy === 'stateless') {
    // Sessions are not stored in the database, so we have no way of knowing whether an account is inactive.
    console.warn('Inactive accounts pruning is not available with the stateless authentication strategy.')
    return
  }
  const db = useDatabaseWithMetadata()
  const cutoff = Date.now() - (days ?? 0) * dayMs
  const users = (await db
    .prepare('SELECT id FROM users WHERE contributorPlan = 0 AND id NOT IN (SELECT userId FROM sessions WHERE expiration > ?)')
    .bind(cutoff)
    .all()) as { id: string }[]
  for (const { id } of users) {
    const bucket = TotpBucket.ofUserId(id)
    const { revision, data } = await bucket.snapshot()
    if (Object.keys(data.active).length) continue
    // Only delete the user if nothing changed in the meantime.
    const deleted = await db.prepare(`DELETE FROM users WHERE id = ? AND contributorPlan = 0
      AND NOT EXISTS (SELECT 1 FROM sessions WHERE userId = users.id AND expiration > ?)
      AND (SELECT revision FROM totpBucketHeads WHERE userId = users.id) IS ?`)
      .bind(id, cutoff, revision).run()
    if (hasExactlyOneChange(deleted)) {
      await bucket.removeStorage(revision)
    }
  }
}
