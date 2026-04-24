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
        return SuccessObject.fromData(await authProvider.callback(event as AppEvent)).toResponse()
      case 'apple':
      default:
        return redirectIntoApp(event, (await authProvider.callback(event as AppEvent)).toString())
    }
  },
})

class MethodNotAllowedError extends AppError {
  constructor() {
    super('Method not allowed.', MethodNotAllowedError, 405)
  }
}
