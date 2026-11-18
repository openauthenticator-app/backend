import backendConfig from '~/backend.config'
import { assert } from '~/utils/assert'
import { ErrorObject, SuccessObject } from '~/utils/response'
import { isPlainObject } from '~/utils/validation'
import { RevenueCatEventHandler, UnauthorizedError } from '~/app'
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

  const webhook = await readBody<Webhook>(event)
  if (!isPlainObject(webhook) || !isPlainObject(webhook.event) || typeof webhook.event.type !== 'string' || typeof webhook.event.event_timestamp_ms !== 'number') {
    return ErrorObject.validationError().toResponse(event)
  }

  await RevenueCatEventHandler.handle(webhook.event)
  return SuccessObject.fromData().toResponse(event)
})
