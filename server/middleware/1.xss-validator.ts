import type { H3Event, HTTPMethod } from 'h3'
import { FilterXSS } from 'xss'
import { AppError } from '~/app'

const methods: HTTPMethod[] = ['GET', 'POST']

export default defineEventHandler(async (event: H3Event) => {
  if (!methods.includes(event.method)) {
    return
  }
  const valueToFilter
    = event.node.req.method === 'GET'
      ? getQuery(event)
      : getHeader(event, 'Content-Type')?.includes('multipart/form-data')
        ? await readMultipartFormData(event)
        : await readBody(event)
  if (valueToFilter && Object.keys(valueToFilter).length) {
    const xssValidator = new FilterXSS()
    if (valueToFilter.errorCode && valueToFilter.errorCode !== AppError.getErrorCodeFromClass(BadRequestError)) {
      return
    }
    const stringifiedValue = JSON.stringify(valueToFilter)
    const processedValue = xssValidator.process(JSON.stringify(valueToFilter))
    if (processedValue !== stringifiedValue) {
      throw new BadRequestError()
    }
  }
})

class BadRequestError extends AppError {
  constructor() {
    super('Bad request.', BadRequestError, 400)
  }
}
