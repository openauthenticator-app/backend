import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = await useUser(event)
  await user.deleteFromDatabase()
  return SuccessObject.fromData()
})
