import { useDatabaseWithMetadata } from '~/utils/db'
import { SuccessObject } from '~/utils/response'
import { TotpBucket } from '~/app'
import { defineHandler, type H3Event, readBody } from 'nitro/h3'

/**
 * Converts the legacy per-TOTP storage keys of existing users to vault revisions.
 * Users are processed by batches, ordered by identifier : call it again with the returned `next` until it is `null`.
 */
export default defineHandler(async (event: H3Event) => {
  const body = await readBody<{ after?: string, limit?: number }>(event)
  const limit = Math.min(Math.max(body?.limit ?? 50, 1), 500)
  const users = (await useDatabaseWithMetadata()
    .prepare('SELECT id FROM users WHERE id > ? ORDER BY id LIMIT ?')
    .bind(body?.after ?? '', limit)
    .all()) as { id: string }[]
  let converted = 0
  const failed: string[] = []
  for (const { id } of users) {
    try {
      if (await TotpBucket.ofUserId(id).convertLegacyKeys()) {
        converted++
      }
    }
    catch (error) {
      console.error(`Could not convert the vault of user ${id}.`, error)
      failed.push(id)
    }
  }
  return SuccessObject.fromData({
    processed: users.length,
    converted,
    failed,
    next: users.length === limit ? users.at(-1)!.id : null,
  }).toResponse(event)
})
