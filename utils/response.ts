import backendConfig from '~/backend.config'
import type { H3Event, HTTPError } from 'nitro/h3'
import { AppError } from '~/app/error'

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

  public toTaskResult(): { result: { success: boolean, data: unknown } } {
    return {
      result: {
        success: this.success,
        data: this.data,
      },
    }
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
      status: 400,
      data: {
        errorCode: 'validation',
        message: 'An error occurred while validating your request. You should verify your parameters and the body of your request.',
      },
    })
  }
}
