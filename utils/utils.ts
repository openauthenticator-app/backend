import { type H3Event, HTTPError } from 'nitro/h3'
import { AppError, type User } from '~/app'

export const assert = (condition: boolean, error?: HTTPError | string): asserts condition => {
  if (!condition) {
    throw error instanceof HTTPError ? error : new AppError(error ?? 'Assertion failed.', 'AssertionFailed')
  }
}

export interface LocalizedRedirectionURL {
  url: URL | string
  locale?: string
}

export const sendRedirectResponse = (event: H3Event, url: LocalizedRedirectionURL): Response => {
  const headers = new Headers(event.res.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  headers.set('Location', url.url.toString())
  const urlString = url.url.toString()
  if (urlString.startsWith('openauthenticator://') && process.env.NODE_ENV !== 'production') {
    console.log(`Trying to open ${urlString}...`)
  }
  return new Response(
    backendConfig.redirectionPageBuilder(url.url, url.locale),
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

  public toResponse(event?: H3Event): Response {
    const headers = new Headers(event?.res.headers)
    headers.set('Content-Type', 'application/json')
    return new Response(
      JSON.stringify({
        success: this.success,
        data: this.data,
      }),
      {
        status: this.status,
        headers,
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
