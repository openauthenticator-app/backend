export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/auth/provider/')) {
    const providerId = getRouterParam(event, 'provider')
    const provider = useAuthProvider(providerId ?? '')
    if (!provider) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Provider not found.',
      })
    }
    event.context.authProvider = provider
  }
})
