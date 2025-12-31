import { AppEvent, Session } from '~/app'

const validateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false
  }
  return 'refreshToken' in body && typeof body.refreshToken === 'string'
}

export default defineEventHandler(async (event) => {
  const appEvent = event as AppEvent
  const { refreshToken } = await readValidatedBody<{ refreshToken: string }>(appEvent, validateBody)
  const session = Session.fromToken(refreshToken, 'refresh')
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid refresh token.',
    })
  }
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await session.refresh(refreshToken, appEvent.context.appClientId)
  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
})
