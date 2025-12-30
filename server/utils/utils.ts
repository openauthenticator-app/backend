export const noError = (message: string = 'Success.') => {
  return { success: true, message: message }
}

export const assert = (condition: boolean, message?: string): asserts condition => {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed.')
  }
}
