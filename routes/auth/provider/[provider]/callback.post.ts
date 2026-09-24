import { useAuthProvider } from '~/utils/auth'
import { requireAppClientId, requireAppVersionHeader } from '~/utils/headers'
import { rateLimit } from '~/utils/ratelimit'
import { sendRedirectResponse, SuccessObject } from '~/utils/utils'
import { AppError, type AppEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    if (!['apple', 'email'].includes(authProvider.id)) {
      throw new MethodNotAllowedError()
    }
    switch (authProvider.id) {
      case 'email':
        requireAppVersionHeader(event)
        requireAppClientId(event)
        return SuccessObject.fromData((await authProvider.callback(event as AppEvent)).url).toResponse(event)
      case 'apple':
      default:
        return sendRedirectResponse(event, await authProvider.callback(event as AppEvent))
    }
  },
})

class MethodNotAllowedError extends AppError {
  constructor() {
    super('Method not allowed.', MethodNotAllowedError, 405)
  }
}
