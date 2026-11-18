import { useDatabaseWithMetadata } from '~/utils/db'
import { schema } from '~/utils/schema'
import { SuccessObject } from '~/utils/utils'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const db = useDatabaseWithMetadata()
  for (const statement of schema) {
    await db.prepare(statement).run()
  }
  return SuccessObject.fromData().toResponse(event)
})
