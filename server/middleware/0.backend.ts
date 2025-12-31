import pkg from '~/../package.json' assert { type: 'json' }

function validateAppVersion(appVersion: string): string | null {
  const parts = appVersion.match(/^[0-9]+\.[0-9]+\.[0-9]+$/)
  return parts ? null : 'Invalid App-Version header.'
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Backend-Version', pkg.version)
  const path = getRequestURL(event).pathname
  if (path === '/') {
    return
  }
  if (path.startsWith('/auth/provider/') && (path.endsWith('/callback') || path.endsWith('/callback/'))) {
    return
  }
  if (path.startsWith('/revenuecat/webhook')) {
    return
  }
  const appVersion = getHeader(event, 'App-Version')
  if (!appVersion) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing App-Version header.',
    })
  }
  const message = validateAppVersion(appVersion)
  if (message) {
    throw createError({
      statusCode: 400,
      statusMessage: message,
    })
  }
  const appClientId = getHeader(event, 'App-Client-Id')
  if (!appClientId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing App-Client-Id header.',
    })
  }
  event.context.appVersion = appVersion
  event.context.appClientId = appClientId
})
