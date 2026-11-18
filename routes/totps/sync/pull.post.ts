import { rateLimit } from '~/utils/ratelimit'
import { SuccessObject } from '~/utils/response'
import { isPlainObject, isValidTimestamp, isValidUUID } from '~/utils/validation'
import { type EncryptedTotp, TotpBucket, type UserEvent, type UUID } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown) => {
  const validTimestamps = (value: unknown) => isPlainObject(value)
    && Object.entries(value).every(([uuid, timestamp]) => isValidUUID(uuid) && isValidTimestamp(timestamp))
  return isPlainObject(body) && validTimestamps(body.active) && validTimestamps(body.deleted)
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

    const { active: totps, deleted: tombstones } = await bucket.read()
    for (const [uuid, totp] of Object.entries(totps)) {
      const activeTimestamp = body.active[uuid as UUID]
      const deletedTimestamp = body.deleted[uuid as UUID]
      const clientKnownAt = Math.max(activeTimestamp ?? -Infinity, deletedTimestamp ?? -Infinity)
      if (totp.updatedAt > clientKnownAt) {
        if (typeof activeTimestamp === 'number') {
          updates[uuid as UUID] = totp
        }
        else {
          inserts[uuid as UUID] = totp
        }
      }
    }

    for (const [uuid, tombstone] of Object.entries(tombstones)) {
      if (tombstone.deletedAt >= (body.active[uuid as UUID] ?? -Infinity) && tombstone.deletedAt > (body.deleted[uuid as UUID] ?? -Infinity)) {
        deletes[uuid as UUID] = tombstone.deletedAt
      }
    }

    return SuccessObject.fromData({
      inserts,
      updates,
      deletes,
    }).toResponse(event)
  },
})
