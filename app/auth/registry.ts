import { AppError } from '~/app/error'
import { AppleProvider } from '~/app/auth/providers/apple'
import { EmailProvider } from '~/app/auth/providers/email'
import { GithubProvider } from '~/app/auth/providers/github'
import { GoogleProvider } from '~/app/auth/providers/google'
import { MicrosoftProvider } from '~/app/auth/providers/microsoft'
import type { AuthProvider } from '~/app/auth/providers/provider'
import { getRouterParam, type H3Event } from 'nitro/h3'

export type AuthProviderId = 'google' | 'apple' | 'microsoft' | 'github' | 'email'

const authProviders: Record<AuthProviderId, AuthProvider> = {
  google: new GoogleProvider(),
  apple: new AppleProvider(),
  microsoft: new MicrosoftProvider(),
  github: new GithubProvider(),
  email: new EmailProvider(),
}

export const useAuthProvider = (event: H3Event) => {
  const providerId = getRouterParam(event, 'provider')
  if (!providerId || !Object.hasOwn(authProviders, providerId)) {
    throw new ProviderNotFoundError()
  }
  return authProviders[providerId as AuthProviderId]
}

class ProviderNotFoundError extends AppError {
  constructor() {
    super(`Provider not found.`, ProviderNotFoundError, 404)
  }
}
