import { defineErrorHandler } from 'nitro'
import type { HTTPError } from 'nitro/h3'
import { ErrorObject } from './utils/utils'

export default defineErrorHandler((error: HTTPError) => {
  if (process.env.NODE_ENV !== 'production' && !error.status.toString().startsWith('4')) {
    console.error(
      error.message,
      error.stack ?? '',
    )
  }
  return new Response(
    JSON.stringify(ErrorObject.fromError(error)),
    {
      status: error.status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
})
