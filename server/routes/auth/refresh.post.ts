import { Session } from '~/app'

const validateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false
  }
  return 'refreshToken' in body && typeof body.refreshToken === 'string' && 'clientId' in body && typeof body.clientId === 'string'
}

export default defineEventHandler(async (event) => {
  const { clientId, refreshToken } = await readValidatedBody<{ refreshToken: string, clientId: string }>(event, validateBody)
  const session = Session.fromToken(refreshToken, 'refresh')
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid refresh token.',
    })
  }
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await session.refresh(refreshToken, clientId)
  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
})
