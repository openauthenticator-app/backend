import { EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

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

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    const timestamps = await readValidatedBody<H3Event, Record<UUID, number>>(event, validateBody)

    const inserts: Record<string, EncryptedTotp> = {}
    const updates: Record<string, EncryptedTotp> = {}
    const totps = await bucket.getAll()
    for (const [uuid, totp] of Object.entries(totps)) {
      const clientTimestamp = timestamps[uuid as UUID]
      if (!clientTimestamp) {
        inserts[uuid] = totp
      }
      else if (totp.updatedAt > clientTimestamp) {
        updates[uuid] = totp
      }
    }

    const deletes = Object.keys(await bucket.getDeleted()).filter(uuid => uuid in timestamps)
    return SuccessObject.fromData({
      inserts,
      updates,
      deletes,
    }).toResponse()
  },
})
