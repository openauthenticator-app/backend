import { ProviderEvent } from '~/app'

export default defineEventHandler(async (event) => {
  const providerEvent = event as ProviderEvent
  return await providerEvent.context.authProvider.login(providerEvent)
})
