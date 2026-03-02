import { AppError, type AppEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler({
  onRequest: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    if (!['apple', 'email'].includes(authProvider.id)) {
      throw new MethodNotAllowedError()
    }
    if (authProvider.id === 'email') {
      requireAppVersionHeader(event)
      requireAppClientId(event)
    }
    return SuccessObject.fromData(await authProvider.callback(event as AppEvent))
  },
})

class MethodNotAllowedError extends AppError {
  constructor() {
    super(`Method not allowed.`, MethodNotAllowedError, 405)
  }
}
