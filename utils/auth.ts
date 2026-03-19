import {
  AppError,
  AppleProvider,
  AuthProvider,
  EmailProvider,
  GithubProvider,
  GoogleProvider,
  MicrosoftProvider,
} from '~/app'
import { getRouterParam, type H3Event } from 'nitro/h3'

const authProviders: Record<string, AuthProvider> = {
  google: new GoogleProvider(),
  apple: new AppleProvider(),
  microsoft: new MicrosoftProvider(),
  github: new GithubProvider(),
  email: new EmailProvider(),
}

export type AuthProviderId = keyof typeof authProviders

export const useAuthProvider = (event: H3Event) => {
  const providerId = getRouterParam(event, 'provider')
  const provider = authProviders[providerId ?? '']
  if (!provider) {
    throw new ProviderNotFoundError()
  }
  return provider
}

class ProviderNotFoundError extends AppError {
  constructor() {
    super(`Provider not found.`, ProviderNotFoundError, 404)
  }
}
