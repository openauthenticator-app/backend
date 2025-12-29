import { Session } from '~/app'

const validateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false
  }
  return 'refreshToken' in body && typeof body.refreshToken === 'string'
}

export default defineEventHandler(async (event) => {
  const { refreshToken } = await readValidatedBody<{ refreshToken: string }>(event, validateBody)
  const session = Session.fromToken(refreshToken, 'refresh')
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid refresh token.',
    })
  }
  await session.revoke(refreshToken)
  return noError()
})
