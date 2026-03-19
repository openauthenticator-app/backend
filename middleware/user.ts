import { defineHandler, getRequestURL, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/totps') || path.startsWith('/user')) {
    event.context.user = await useUser(event)
  }
})
