import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/totps') || path.startsWith('/user')) {
    event.context.user = await useUser(event)
  }
})
