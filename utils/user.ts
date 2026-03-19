import { AppError, Session, User } from '~/app'
import type { H3Event } from 'nitro/h3'

export const useUser = async (event: H3Event) => {
  const session = await Session.fromAuthorizationHeader(event)
  const user = await User.findInDatabase({ id: session.userId })
  if (!user) {
    throw new UserNotFoundError()
  }
  return user
}

class UserNotFoundError extends AppError {
  constructor() {
    super(`Your user id was not found in the database.`, UserNotFoundError, 403)
  }
}
