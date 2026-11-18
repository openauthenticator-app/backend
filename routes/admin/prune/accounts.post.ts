import { SuccessObject } from '~/utils/response'
import { pruneInactiveAccounts } from '~/app'
import { defineHandler, type H3Event, readBody } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const body = await readBody<{ days: number | undefined }>(event)
  await pruneInactiveAccounts(body?.days)
  return SuccessObject.fromData().toResponse(event)
})
