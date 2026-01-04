import { AppleProvider, AuthProvider, EmailProvider, GithubProvider, GoogleProvider, MicrosoftProvider, } from '~/app'

const authProviders: Record<string, AuthProvider> = {
  google: new GoogleProvider(),
  apple: new AppleProvider(),
  microsoft: new MicrosoftProvider(),
  github: new GithubProvider(),
  email: new EmailProvider(),
}

export type AuthProviderId = keyof typeof authProviders

export const useAuthProvider = (provider: AuthProviderId) => authProviders[provider]
