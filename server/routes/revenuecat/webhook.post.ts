import { RevenueCatEventHandler } from '~/app'
import type { Webhook } from '@puzzmo/revenue-cat-webhook-types'

export default defineEventHandler(async (event) => {
  const expected = backendConfig.revenueCat.authorizationHeader

  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'RevenueCat authorization header not configured.',
    })
  }

  const auth = getHeader(event, 'Authorization') ?? ''
  if (auth !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized.',
    })
  }

  const webhook: Webhook = await readBody<Webhook>(event)
  await RevenueCatEventHandler.handle(event, webhook.event)
  return noError()
})
