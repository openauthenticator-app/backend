import { Session } from '~/app'
import type { H3Event } from 'h3'

const validateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false
  }
  return 'refreshToken' in body && typeof body.refreshToken === 'string'
}

export default defineEventHandler({
  onRequest: [rateLimit()],
  handler: async (event: H3Event) => {
    const { refreshToken } = await readValidatedBody<{ refreshToken: string }>(event, validateBody)
    await Session.fromToken(refreshToken, 'refresh').revoke(refreshToken)
    return SuccessObject.fromData()
  },
})
