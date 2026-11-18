import { useDatabaseWithMetadata } from '~/utils/db'
import { schema, tables } from '~/app/database/schema'
import { SuccessObject } from '~/utils/response'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const db = useDatabaseWithMetadata()
  for (const table of tables) {
    await db.prepare(`DROP TABLE IF EXISTS ${table}`).run()
  }
  for (const statement of schema) {
    await db.prepare(statement).run()
  }
  return SuccessObject.fromData().toResponse(event)
})
