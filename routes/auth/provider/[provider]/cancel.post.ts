import { useAuthProvider } from '~/app/auth/registry'
import { rateLimit } from '~/utils/ratelimit'
import { SuccessObject } from '~/utils/response'
import { AppError, type AppEvent, EmailProvider } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    if (!(authProvider instanceof EmailProvider)) {
      throw new MethodNotAllowedError()
    }
    await authProvider.cancel(event as AppEvent)
    return SuccessObject.fromData().toResponse(event)
  },
})

class MethodNotAllowedError extends AppError {
  constructor() {
    super('Method not allowed.', MethodNotAllowedError, 405)
  }
}
