import backendConfig from '~/backend.config'
import { ensureSchemaUpgrade, useDatabaseWithMetadata } from '~/utils/db'
import type { Attributes, Webhook } from '@puzzmo/revenue-cat-webhook-types'
import { AppError } from '~/app/error'

export class RevenueCatEventHandler {
  static async handle(event: Webhook['event']) {
    if ('subscriber_attributes' in event && event.subscriber_attributes) {
      const host = (event.subscriber_attributes as Attributes).backend?.value
      const expected = new URL(backendConfig.url).hostname
      if (host && host !== expected) throw new InvalidBackendHostError(expected)
    }
    switch (event.type) {
      case 'TRANSFER':
        for (const user of event.transferred_from) await RevenueCatWebhookEventStore.apply(event, user, 'TRANSFER_OUT')
        for (const user of event.transferred_to) await RevenueCatWebhookEventStore.apply(event, user, 'TRANSFER_IN')
        break
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'NON_RENEWING_PURCHASE':
      case 'SUBSCRIPTION_EXTENDED':
      case 'UNCANCELLATION':
      case 'EXPIRATION':
      case 'TEMPORARY_ENTITLEMENT_GRANT': {
        const entitlement = backendConfig.revenueCat.contributorPlanEntitlementId
        if (event.entitlement_ids && (!entitlement || event.entitlement_ids.includes(entitlement))) {
          await RevenueCatWebhookEventStore.apply(event, event.app_user_id, event.type)
        }
        break
      }
    }
  }
}

export class RevenueCatWebhookEventStore {
  static async pruneProcessedEvents(days = 365) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    // Keep the latest event as an ordering watermark while the account exists.
    const result = await useDatabaseWithMetadata().prepare(
      `DELETE FROM revenueCatWebhookEvents AS e WHERE createdAt < ?
       AND (NOT EXISTS (SELECT 1 FROM users WHERE id = e.userId) OR EXISTS (
         SELECT 1 FROM revenueCatWebhookEvents AS newer WHERE newer.userId = e.userId
         AND (newer.eventTimestamp, newer.eventId) > (e.eventTimestamp, e.eventId)))`,
    ).bind(cutoff).run()
    return result.success
  }

  static async apply(event: Webhook['event'], userId: string, type: string) {
    await ensureSchemaUpgrade()
    // The insert's trigger checks ordering and updates the account in the same SQL transaction.
    const result = await useDatabaseWithMetadata()
      .prepare('INSERT OR IGNORE INTO revenueCatWebhookEvents (eventId, userId, eventTimestamp, type, createdAt) VALUES (?, ?, ?, ?, ?)')
      .bind(this.getEventId(event), userId, event.event_timestamp_ms, type, Date.now()).run()
    if (!result.success) throw new AppError('Could not record subscription event.', 'subscriptionUpdate', 500)
  }

  static getEventId(webhookEvent: Webhook['event']) {
    if ('id' in webhookEvent && typeof webhookEvent.id === 'string') {
      return webhookEvent.id
    }
    if ('transaction_id' in webhookEvent && typeof webhookEvent.transaction_id === 'string') {
      return `${webhookEvent.type}:${webhookEvent.transaction_id}:${webhookEvent.event_timestamp_ms}`
    }
    return `${webhookEvent.type}:${webhookEvent.event_timestamp_ms}`
  }
}

class InvalidBackendHostError extends AppError {
  constructor(targetValue: string) {
    super(`Invalid backend host. Must be ${targetValue}.`, InvalidBackendHostError, 400)
  }
}
