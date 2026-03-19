import { defineHandler, getRequestURL, type H3Event, HTTPError } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/admin')) {
    return
  }
  const targetHeader = backendConfig.adminHeader
  if (!targetHeader && process.env.NODE_ENV === 'production') {
    throw new HTTPError(
      'Admin header is not set in production.',
      {
        status: 500,
      },
    )
  }
  const auth = event.req.headers.get('Authorization')
  if (auth !== targetHeader) {
    throw new HTTPError(
      'Unauthorized.',
      {
        status: 401,
      },
    )
  }
})
