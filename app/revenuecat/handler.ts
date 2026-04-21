import type {
  Attributes,
  Webhook,
  WebhookExpiration,
  WebhookInitialPurchase,
  WebhookRenewal,
  WebhookTemporaryEntitlementGrant,
  WebhookTransfer,
} from '@puzzmo/revenue-cat-webhook-types'
import type { H3Event } from 'nitro/h3'
import { AppError } from '~/app/error'
import { User } from '~/app/user'

export abstract class RevenueCatEventHandler<T extends Webhook['event']> {
  protected async handle(httpEvent: H3Event, webhookEvent: T): Promise<void> {
    console.log(`Received a RevenueCat webhook event : ${webhookEvent.type}.`)
  }

  static handle(httpEvent: H3Event, webhookEvent: Webhook['event']) {
    if ('subscriber_attributes' in webhookEvent && typeof webhookEvent.subscriber_attributes === 'object') {
      const attributes = webhookEvent.subscriber_attributes as Attributes
      const backend = attributes['backend']
      const targetValue = new URL(backendConfig.url).hostname
      if (backend?.value !== targetValue) {
        throw new InvalidBackendHostError(targetValue)
      }
    }
    let handler: RevenueCatEventHandler<typeof webhookEvent>
    switch (webhookEvent.type) {
      case 'INITIAL_PURCHASE':
        handler = new InitialPurchaseHandler()
        break
      case 'RENEWAL':
        handler = new RenewalHandler()
        break
      case 'EXPIRATION':
        handler = new ExpirationHandler()
        break
      case 'TEMPORARY_ENTITLEMENT_GRANT':
        handler = new TemporaryEntitlementGrantHandler()
        break
      case 'TRANSFER':
        handler = new TransferHandler()
        break
      default:
        handler = new UnknownEventHandler()
        break
    }
    return handler.handle(httpEvent, webhookEvent)
  }
}

class ContributorPlanHandler<T extends Webhook['event'] & { app_user_id: string, entitlement_ids: string[] | null }> extends RevenueCatEventHandler<T> {
  private readonly grantAccess: boolean

  constructor(grantAccess: boolean) {
    super()
    this.grantAccess = grantAccess
  }

  protected override async handle(httpEvent: H3Event, webhookEvent: T) {
    await super.handle(httpEvent, webhookEvent)
    if (!webhookEvent.entitlement_ids || (backendConfig.revenueCat.contributorPlanEntitlementId && !webhookEvent.entitlement_ids.includes(backendConfig.revenueCat.contributorPlanEntitlementId))) {
      return
    }
    if (!(await RevenueCatWebhookEventStore.canProcess(webhookEvent, webhookEvent.app_user_id))) {
      return
    }
    const user = await User.findInDatabase({ id: webhookEvent.app_user_id })
    if (user) {
      if (!(await user.updateInDatabase({ contributorPlan: this.grantAccess }))) {
        throw new UserUpdateError(webhookEvent.app_user_id)
      }
    }
    else {
      console.warn(`RevenueCat webhook ${RevenueCatWebhookEventStore.getEventId(webhookEvent)} ignored because user ${webhookEvent.app_user_id} was not found.`)
    }
    await RevenueCatWebhookEventStore.markProcessed(webhookEvent, webhookEvent.app_user_id)
  }
}

class InitialPurchaseHandler extends ContributorPlanHandler<WebhookInitialPurchase> {
  constructor() {
    super(true)
  }
}

class RenewalHandler extends ContributorPlanHandler<WebhookRenewal> {
  constructor() {
    super(true)
  }
}

class ExpirationHandler extends ContributorPlanHandler<WebhookExpiration> {
  constructor() {
    super(false)
  }
}

class TemporaryEntitlementGrantHandler extends ContributorPlanHandler<WebhookTemporaryEntitlementGrant> {
  constructor() {
    super(true)
  }
}

class TransferHandler extends RevenueCatEventHandler<WebhookTransfer> {
  protected override async handle(httpEvent: H3Event, webhookEvent: WebhookTransfer) {
    await super.handle(httpEvent, webhookEvent)

    for (const userId of webhookEvent.transferred_from) {
      if (!(await RevenueCatWebhookEventStore.canProcess(webhookEvent, userId))) {
        continue
      }
      const oldUser = await User.findInDatabase({ id: userId })
      if (oldUser) {
        if (!(await oldUser.updateInDatabase({ contributorPlan: false }))) {
          throw new UserUpdateError(userId)
        }
      }
      else {
        console.warn(`RevenueCat webhook ${webhookEvent.id} ignored because transferred-from user ${userId} was not found.`)
      }
      await RevenueCatWebhookEventStore.markProcessed(webhookEvent, userId)
    }

    for (const userId of webhookEvent.transferred_to) {
      if (!(await RevenueCatWebhookEventStore.canProcess(webhookEvent, userId))) {
        continue
      }
      const newUser = await User.findInDatabase({ id: userId })
      if (newUser) {
        if (!(await newUser.updateInDatabase({ contributorPlan: true }))) {
          throw new UserUpdateError(userId)
        }
      }
      else {
        console.warn(`RevenueCat webhook ${webhookEvent.id} ignored because transferred-to user ${userId} was not found.`)
      }
      await RevenueCatWebhookEventStore.markProcessed(webhookEvent, userId)
    }
  }
}

class UnknownEventHandler extends RevenueCatEventHandler<Webhook['event']> {}

class RevenueCatWebhookEventStore {
  static async pruneProcessedEvents(days?: number) {
    const cutoff = Date.now() - (days ?? 365) * 24 * 60 * 60 * 1000
    const result = await useDatabaseWithMetadata()
      .prepare('DELETE FROM revenueCatWebhookEvents WHERE createdAt < ?')
      .bind(cutoff)
      .run()

    return !!result.success
  }

  static async canProcess(webhookEvent: Webhook['event'], userId: string) {
    const eventId = this.getEventId(webhookEvent)

    const existingEvent = await useDatabaseWithMetadata()
      .prepare('SELECT eventId FROM revenueCatWebhookEvents WHERE eventId = ? AND userId = ? LIMIT 1')
      .bind(eventId, userId)
      .get()

    if (existingEvent) {
      console.log(`RevenueCat webhook ${eventId} ignored because it has already been processed for user ${userId}.`)
      return false
    }

    const latestEvent = await useDatabaseWithMetadata()
      .prepare('SELECT MAX(eventTimestamp) AS eventTimestamp FROM revenueCatWebhookEvents WHERE userId = ?')
      .bind(userId)
      .get() as { eventTimestamp?: number | null } | undefined

    if (latestEvent?.eventTimestamp != null && latestEvent.eventTimestamp > webhookEvent.event_timestamp_ms) {
      console.log(`RevenueCat webhook ${eventId} ignored because a newer event was already processed for user ${userId}.`)
      await this.markProcessed(webhookEvent, userId)
      return false
    }

    return true
  }

  static async markProcessed(webhookEvent: Webhook['event'], userId: string) {
    await useDatabaseWithMetadata()
      .prepare('INSERT OR IGNORE INTO revenueCatWebhookEvents (eventId, userId, eventTimestamp, type, createdAt) VALUES (?, ?, ?, ?, ?)')
      .bind(this.getEventId(webhookEvent), userId, webhookEvent.event_timestamp_ms, webhookEvent.type, Date.now())
      .run()
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

class UserUpdateError extends AppError {
  constructor(userId: string) {
    super(`Unable to update user ${userId}.`, UserUpdateError, 500)
  }
}
