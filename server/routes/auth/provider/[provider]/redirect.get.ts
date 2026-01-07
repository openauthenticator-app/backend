import type { AppEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const authProvider = useAuthProvider(event)
  return await redirectIntoApp(event, (await authProvider.redirect(event as AppEvent)).toString())
})
