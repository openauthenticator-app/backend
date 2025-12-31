import {
  AppleProvider,
  AuthProvider,
  EmailProvider,
  GithubProvider,
  GoogleProvider,
  MicrosoftProvider,
  Session,
  User,
} from '~/app'
import { H3Event } from 'h3'

const authProviders: Record<string, AuthProvider> = {
  google: new GoogleProvider(),
  apple: new AppleProvider(),
  microsoft: new MicrosoftProvider(),
  github: new GithubProvider(),
  email: new EmailProvider(),
}

export type AuthProviderId = keyof typeof authProviders

export const useAuthProvider = (provider: AuthProviderId) => authProviders[provider]

export const useUser = async (event: H3Event) => {
  const session = Session.fromAuthorizationHeader(event)
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'You must be logged in to access this resource.',
    })
  }
  const user = await User.findInDatabase({ id: session.userId })
  if (!user) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Your user id was not found in the database.',
    })
  }
  return user
}
