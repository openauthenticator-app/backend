import { defineErrorHandler } from 'nitro'
import type { HTTPError } from 'nitro/h3'
import { ErrorObject } from './utils/response'

export default defineErrorHandler((error: HTTPError) => {
  if (!error.status.toString().startsWith('4')) {
    console.error(
      error.message,
      error.stack ?? '',
    )
  }
  return ErrorObject.fromError(error).toResponse()
})
