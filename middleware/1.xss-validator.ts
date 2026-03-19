import { FilterXSS } from 'xss'
import { AppError } from '~/app'
import { defineHandler, getQuery, type H3Event, type HTTPMethod, readBody } from 'nitro/h3'

const methods: HTTPMethod[] = ['GET', 'POST']

export default defineHandler(async (event: H3Event) => {
  if (!methods.includes(event.req.method as HTTPMethod)) {
    return
  }
  const valueToFilter
    = event.req.method === 'GET'
      ? getQuery(event)
      : event.req.headers.get('Content-Type')?.includes('multipart/form-data')
        ? await event.req.formData()
        : await readBody(event)
  if (valueToFilter && Object.keys(valueToFilter).length) {
    // @ts-expect-error We check if `errorCode` is invalid after.
    if (valueToFilter.errorCode && valueToFilter.errorCode !== AppError.getErrorCodeFromClass(BadRequestError)) {
      return
    }
    const xssValidator = new FilterXSS()
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
