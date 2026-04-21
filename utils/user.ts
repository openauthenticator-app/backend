import { AppError, type AppEvent, Session, User } from '~/app'

export const useUser = async (event: AppEvent) => {
  const session = await Session.readAndVerifyFromAuthorizationHeader(event)
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
