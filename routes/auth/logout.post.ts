import { Session } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false
  }
  return 'refreshToken' in body && typeof body.refreshToken === 'string'
}

export default defineHandler({
  middleware: [rateLimit()],
  handler: async (event: H3Event) => {
    const { refreshToken } = await readValidatedBody<H3Event, { refreshToken: string }>(event, validateBody)
    const session = await Session.fromToken(refreshToken, 'refresh')
    await session.revoke(refreshToken)
    return SuccessObject.fromData()
  },
})
