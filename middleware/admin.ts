import { defineHandler, type H3Event } from 'nitro/h3'
import { AppError } from '~/app/error'

export default defineHandler(async (event: H3Event) => {
  if (!event.url.pathname.startsWith('/admin')) {
    return
  }
  const targetHeader = backendConfig.adminHeader
  if (!targetHeader) {
    throw new AdminHeaderNotSetError()
  }
  const auth = event.req.headers.get('Authorization')
  if (auth !== targetHeader) {
    throw new UnauthorizedError()
  }
})

class AdminHeaderNotSetError extends AppError {
  constructor() {
    super('Admin header is not set.', AdminHeaderNotSetError, 500)
  }
}

class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized.', UnauthorizedError, 401)
  }
}
