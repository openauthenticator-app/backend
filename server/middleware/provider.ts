import { AppError } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/auth/provider/')) {
    const providerId = getRouterParam(event, 'provider')
    const provider = useAuthProvider(providerId ?? '')
    if (!provider) {
      throw new ProviderNotFoundError()
    }
    event.context.authProvider = provider
  }
})

class ProviderNotFoundError extends AppError {
  constructor() {
    super(`Provider not found.`, ProviderNotFoundError, 404)
  }
}
