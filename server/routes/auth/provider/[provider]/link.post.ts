import type { AppEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const authProvider = useAuthProvider(event)
  return SuccessObject.fromData(await authProvider.link(event as AppEvent))
})
