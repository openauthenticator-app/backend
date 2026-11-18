import { HTTPError } from 'nitro/h3'
import { AppError } from '~/app/error'

export function assert(condition: boolean, error?: HTTPError | string): asserts condition {
  if (!condition) {
    throw error instanceof HTTPError ? error : new AppError(error ?? 'Assertion failed.', 'AssertionFailed')
  }
}
