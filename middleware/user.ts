import type { AppEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler(async (event: H3Event) => {
  if (event.url.pathname.startsWith('/totps') || event.url.pathname.startsWith('/user')) {
    event.context.user = await useUser(event as AppEvent)
  }
})
