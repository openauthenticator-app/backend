import type {
  Webhook,
  WebhookExpiration,
  WebhookInitialPurchase,
  WebhookRenewal,
  WebhookTemporaryEntitlementGrant,
  WebhookTransfer,
} from '@puzzmo/revenue-cat-webhook-types'
import { H3Event } from 'h3'
import { AppError } from '~/app/error'
import { User } from '~/app/user'

export abstract class RevenueCatEventHandler<T extends Webhook['event']> {
  protected async handle(httpEvent: H3Event, webhookEvent: T): Promise<void> {
    console.log(`Received a RevenueCat webhook event : ${webhookEvent.type}.`)
  }

  static handle(httpEvent: H3Event, webhookEvent: Webhook['event']) {
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
    const user = await User.findInDatabase({ id: webhookEvent.app_user_id })
    if (!user) {
      throw new UserNotFoundError(webhookEvent.app_user_id)
    }
    await user.updateInDatabase({ contributorPlan: this.grantAccess })
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

    const oldUser = await User.findInDatabase({ id: webhookEvent.transferred_from[0] })
    if (oldUser) {
      await oldUser.updateInDatabase({ contributorPlan: false })
    }

    const newUser = await User.findInDatabase({ id: webhookEvent.transferred_to[0] })
    if (newUser) {
      await newUser.updateInDatabase({ contributorPlan: true })
    }
  }
}

class UnknownEventHandler extends RevenueCatEventHandler<Webhook['event']> {}

class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User not found : ${userId}.`, UserNotFoundError, 404)
  }
}
