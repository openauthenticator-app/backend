import { type AppEvent, Session } from '~/app'
import { defineHandler, type H3Event, readValidatedBody } from 'nitro/h3'

const validateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false
  }
  return 'refreshToken' in body && typeof body.refreshToken === 'string'
}

export default defineHandler({
  middleware: [rateLimit({ limit: 5 })],
  handler: async (event: H3Event) => {
    const appEvent = event as AppEvent
    const { refreshToken } = await readValidatedBody<H3Event, { refreshToken: string }>(appEvent, validateBody)
    const session = await Session.fromToken(refreshToken, 'refresh')
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await session.refresh(refreshToken, appEvent.context.appClientId)
    return SuccessObject.fromData({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  },
})
