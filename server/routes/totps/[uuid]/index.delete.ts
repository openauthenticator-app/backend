import { TotpBucket, type UserEvent, type UUID } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const totpUuid = getRouterParam(event, 'uuid')!
  assert(isValidUUID(totpUuid), 'Invalid UUID.')
  const userEvent = event as UserEvent
  const bucket = TotpBucket.of(userEvent.context.user)
  if (await bucket.has(totpUuid as UUID)) {
    await bucket.delete(totpUuid as UUID)
  }
  return SuccessObject.fromData()
})
