import type { H3Error, H3Event } from 'h3'

export default defineNitroErrorHandler((error: H3Error, event: H3Event) => {
  setResponseStatus(event, error.statusCode)
  return send(event, JSON.stringify(ErrorObject.fromError(error).toJson()), 'application/json')
})
