import { AppError, RevenueCatEventHandler } from '~/app'
import type { Webhook } from '@puzzmo/revenue-cat-webhook-types'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const expected = backendConfig.revenueCat.authorizationHeader
  assert(!!expected, 'RevenueCat authorization header not configured.')

  const auth = getHeader(event, 'Authorization') ?? ''
  if (auth !== expected) {
    throw new UnauthorizedError()
  }

  const webhook: Webhook = await readBody<Webhook>(event)
  await RevenueCatEventHandler.handle(event, webhook.event)
  return SuccessObject.fromData()
})

class UnauthorizedError extends AppError {
  constructor() {
    super(`Unauthorized.`, UnauthorizedError, 401)
  }
}
