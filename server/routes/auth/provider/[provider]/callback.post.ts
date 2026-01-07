import { AppError, type AppEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const authProvider = useAuthProvider(event)
  if (!['apple', 'email'].includes(authProvider.id)) {
    throw new MethodNotAllowedError()
  }
  return redirectIntoApp(event, (await authProvider.callback(event as AppEvent)).toString())
})

class MethodNotAllowedError extends AppError {
  constructor() {
    super(`Method not allowed.`, MethodNotAllowedError, 405)
  }
}
