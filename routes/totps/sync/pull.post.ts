import { type EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown) => {
  if (!body || typeof body !== 'object') {
    return false
  }
  if (!('active' in body) || typeof body.active !== 'object') {
    return false
  }
  if (!('deleted' in body) || typeof body.deleted !== 'object') {
    return false
  }
  const validateTimestamps = (timestamps: object | null) => {
    if (!timestamps) {
      return false
    }
    for (const [key, value] of Object.entries(timestamps)) {
      if (!isValidUUID(key)) {
        return false
      }
      if (typeof value !== 'number') {
        return false
      }
    }
    return true
  }
  return validateTimestamps(body.active) && validateTimestamps(body.deleted)
}

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const userEvent = event as UserEvent
    const bucket = TotpBucket.of(userEvent.context.user)
    const body = await readValidatedBody<H3Event, Record<'active' | 'deleted', Record<UUID, number>>>(event, validateBody)

    const inserts: Record<UUID, EncryptedTotp> = {}
    const updates: Record<UUID, EncryptedTotp> = {}
    const deletes: Record<UUID, number> = {}

    const totps = await bucket.getAll()
    for (const [uuid, totp] of Object.entries(totps)) {
      const activeTimestamp = body.active[uuid as UUID]
      const deletedTimestamp = body.deleted[uuid as UUID]
      const clientKnownAt = Math.max(activeTimestamp ?? 0, deletedTimestamp ?? 0)
      if (totp.updatedAt > clientKnownAt) {
        if (typeof activeTimestamp === 'number') {
          updates[uuid as UUID] = totp
        }
        else {
          inserts[uuid as UUID] = totp
        }
      }
    }

    const tombstones = await bucket.getTombstones()
    for (const [uuid, tombstone] of Object.entries(tombstones)) {
      const clientKnownAt = Math.max(body.active[uuid as UUID] ?? 0, body.deleted[uuid as UUID] ?? 0)
      if (tombstone.deletedAt > clientKnownAt) {
        deletes[uuid as UUID] = tombstones[uuid as UUID].deletedAt
      }
    }

    return SuccessObject.fromData({
      inserts,
      updates,
      deletes,
    }).toResponse()
  },
})
