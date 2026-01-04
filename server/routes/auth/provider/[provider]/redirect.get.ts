import type { ProviderEvent } from '~/app'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const providerEvent = event as ProviderEvent
  return await sendRedirect(event, (await providerEvent.context.authProvider.redirect(providerEvent)).toString())
})
