import type { H3Error, H3Event } from 'h3'

export default defineNitroErrorHandler((error: H3Error, event: H3Event) => {
  if (process.env.NODE_ENV !== 'production' && !error.statusCode.toString().startsWith('4')) {
    console.error(
      error.message,
      error.stack ?? '',
    )
  }
  setResponseStatus(event, error.statusCode)
  return send(event, JSON.stringify(ErrorObject.fromError(error)), 'application/json')
})
