import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/admin')) {
    return
  }
  const targetHeader = backendConfig.adminHeader
  if (!targetHeader && process.env.NODE_ENV === 'production') {
    throw createError({
      status: 500,
      message: 'Admin header is not set in production.',
    })
  }
  const auth = getHeader(event, 'Authorization')
  if (auth !== targetHeader) {
    throw createError({
      status: 401,
      message: 'Unauthorized.',
    })
  }
})
