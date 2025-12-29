import type { AuthProvider } from '~/app'

export default defineEventHandler(async (event) => {
  return await (event.context.authProvider as AuthProvider).unlink(event)
})
