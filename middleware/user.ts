import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  const url = event.req.url
  if (url.startsWith('/totps') || url.startsWith('/user')) {
    event.context.user = await useUser(event)
  }
})
