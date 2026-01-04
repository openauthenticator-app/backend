import { H3Error } from 'h3'
import { AppError, type AuthProvider, type User } from '~/app'

export const assert = (condition: boolean, error?: H3Error | string): asserts condition => {
  if (!condition) {
    throw error instanceof H3Error ? error : new AppError(error ?? 'Assertion failed.', 'AssertionFailed')
  }
}

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
    this.data = options.data
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJson(): Record<string, any> {
    return {
      success: this.success,
      data: this.data ?? {},
    }
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
    const data: Record<string, string | number> = {
      message: error.message,
    }
    if (error instanceof AppError) {
      data.errorCode = error.errorCode
    }
    return new ErrorObject({
      data,
    })
  }
}

declare module 'h3' {
  interface H3EventContext {
    user?: User
    authProvider?: AuthProvider
    appVersion?: string
    appClientId?: string
  }
}
