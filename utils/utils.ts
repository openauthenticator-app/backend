import { type H3Event, HTTPError } from 'nitro/h3'
import { AppError, type User } from '~/app'

export const assert = (condition: boolean, error?: HTTPError | string): asserts condition => {
  if (!condition) {
    throw error instanceof HTTPError ? error : new AppError(error ?? 'Assertion failed.', 'AssertionFailed')
  }
}

export const redirectIntoApp = (event: H3Event, url: URL | string): Response => {
  const headers = new Headers(event.res.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  headers.set('Location', url.toString())
  const urlString = url.toString()
  if (urlString.startsWith('openauthenticator://') && process.env.NODE_ENV !== 'production') {
    console.log(`Trying to open ${urlString}...`)
  }
  const escapedUrl = JSON.stringify(urlString)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${escapedUrl}" />
  <title>Open Authenticator</title>
  <script>window.location.href = ${escapedUrl};</script>
</head>
<body>
  <p>
    Redirecting you to the Open Authenticator app...
    Please click <a href=${escapedUrl}>here</a> if you're not being redirected.
  </p>
</body>
</html>`
  return new Response(
    html,
    {
      status: 302,
      statusText: 'Found',
      headers,
    },
  )
}

export const booleanToNumber = (value: boolean): 0 | 1 => value ? 1 : 0

export const numberToBoolean = (value: number): boolean => value === 1

export class ReturnObject {
  success: boolean
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any

  constructor(
    options: {
      success: boolean
      status?: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any
    },
  ) {
    this.success = options.success
    this.status = options.status ?? 200
    this.data = options.data ?? {}
  }

  public toResponse(): Response {
    return new Response(
      JSON.stringify({
        success: this.success,
        data: this.data,
      }),
      {
        status: this.status,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

export class SuccessObject extends ReturnObject {
  constructor(
    options: {
      status?: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any
    } = {},
  ) {
    super({
      success: true,
      ...options,
    })
  }

  static fromData(data?: unknown) {
    return new SuccessObject({
      data,
    })
  }
}

export class ErrorObject extends ReturnObject {
  constructor(
    options: {
      status?: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any
    },
  ) {
    super({
      success: false,
      ...options,
    })
  }

  static fromError(error: HTTPError): ErrorObject {
    const data: Record<string, string | number> = {}
    if (error instanceof AppError) {
      data.errorCode = error.errorCode
    }
    else if (error.status === 400 && error.message === 'Validation failed') {
      return ErrorObject.validationError()
    }
    data.message = error.message
    return new ErrorObject({
      status: error.status ?? 500,
      data,
    })
  }

  static validationError(): ErrorObject {
    return new ErrorObject({
      data: {
        status: 400,
        errorCode: 'validation',
        message: 'An error occurred while validating your request. You should verify your parameters and the body of your request.',
      },
    })
  }
}

declare module 'h3' {
  interface H3EventContext {
    user?: User
    appVersion?: string
    appClientId?: string
  }
}
