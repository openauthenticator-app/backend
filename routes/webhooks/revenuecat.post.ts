import { AppError, RevenueCatEventHandler } from '~/app'
import type { Webhook } from '@puzzmo/revenue-cat-webhook-types'
import { timingSafeEqual } from 'node:crypto'
import { defineHandler, type H3Event, readBody } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const expected = backendConfig.revenueCat.authorizationHeader
  assert(!!expected, 'RevenueCat authorization header not configured.')

  const auth = event.req.headers.get('Authorization') ?? ''

  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  if (a.byteLength !== b.byteLength || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError()
  }

  const webhook: Webhook | undefined = await readBody<Webhook>(event)
  if (!webhook) {
    return ErrorObject.validationError()
  }

  await RevenueCatEventHandler.handle(event, webhook.event)
  return SuccessObject.fromData()
})

class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized.', UnauthorizedError, 401)
  }
}
