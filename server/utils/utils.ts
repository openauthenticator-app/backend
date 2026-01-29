import { H3Error, type H3Event } from 'h3'
import { AppError, type User } from '~/app'

export const assert = (condition: boolean, error?: H3Error | string): asserts condition => {
  if (!condition) {
    throw error instanceof H3Error ? error : new AppError(error ?? 'Assertion failed.', 'AssertionFailed')
  }
}

export const redirectIntoApp = (event: H3Event, url: URL | string): ReturnType<typeof sendRedirect> => {
  const urlString = url.toString()
  if (urlString.startsWith('openauthenticator://') && process.env.NODE_ENV !== 'production') {
    console.log(`Trying to open ${urlString}...`)
  }
  return sendRedirect(event, urlString)
}

export const booleanToNumber = (value: boolean): 0 | 1 => value ? 1 : 0

export const numberToBoolean = (value: number): boolean => value === 1

export class ReturnObject {
  success: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any

  constructor(
    options: {
      success: boolean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any
    },
  ) {
    this.success = options.success
    this.data = options.data ?? {}
  }
}

export class SuccessObject extends ReturnObject {
  constructor(
    options: {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any
    },
  ) {
    super({
      success: false,
      ...options,
    })
  }

  static fromError(error: H3Error): ErrorObject {
    const data: Record<string, string | number> = {}
    let message = error.message
    if (error instanceof AppError) {
      data.errorCode = error.errorCode
    }
    else if (error.statusCode === 400 && error.message === 'Validation Error') {
      data.errorCode = 'validation'
      message = 'An error occurred while validating your request. You should verify your parameters and the body of your request.'
    }
    data.message = message
    return new ErrorObject({
      data,
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
