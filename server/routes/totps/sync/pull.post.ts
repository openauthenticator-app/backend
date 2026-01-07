import { H3Event } from 'h3'
import { EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'

const validateBody = (body: unknown) => {
  if (!body || typeof body !== 'object') {
    return false
  }
  for (const [key, value] of Object.entries(body as object)) {
    if (!isValidUUID(key)) {
      return false
    }
    if (typeof value !== 'number') {
      return false
    }
  }
  return true
}

export default defineEventHandler(async (event: H3Event) => {
  const userEvent = event as UserEvent
  const bucket = TotpBucket.of(userEvent.context.user)
  const timestamps = await readValidatedBody<Record<UUID, number>>(event, validateBody)

  const inserts: Record<string, EncryptedTotp> = {}
  const updates: Record<string, EncryptedTotp> = {}
  const totps = await bucket.getAll()
  for (const [uuid, totp] of Object.entries(totps)) {
    const clientTimestamp = timestamps[uuid as UUID]
    if (!clientTimestamp) {
      inserts[uuid] = totp
      delete timestamps[uuid as UUID]
    }
    else if (totp.updatedAt > clientTimestamp) {
      updates[uuid] = totp
      delete timestamps[uuid as UUID]
    }
  }

  return SuccessObject.fromData({
    updates,
    deletes: Object.keys(timestamps),
  })
})
