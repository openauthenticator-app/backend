import backendConfig from '~/backend.config'
import { assert } from '~/utils/utils'
import { createAuthorizationUrl, exchangeAuthorizationCode, type OAuthTokens } from '~/app/auth/oauth'
import { OAuthProvider } from '~/app/auth/providers/provider'

export class GoogleProvider extends OAuthProvider {
  constructor() {
    super('google', true)
    assert(!!backendConfig.authentication.providers.google.clientId, 'Missing Google client ID.')
    assert(!!backendConfig.authentication.providers.google.clientSecret, 'Missing Google client secret.')
  }

  override buildRedirectionUrl(state: string, codeVerifier: string): Promise<URL> {
    return createAuthorizationUrl(
      'https://accounts.google.com/o/oauth2/v2/auth',
      backendConfig.authentication.providers.google.clientId!,
      `${backendConfig.url}/auth/provider/google/callback`,
      state,
      [
        'openid',
        // 'email',
        // 'profile',
      ],
      codeVerifier,
    )
  }

  protected override validateAuthorizationCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
    return exchangeAuthorizationCode({
      endpoint: 'https://oauth2.googleapis.com/token',
      code,
      codeVerifier,
      redirectUri: `${backendConfig.url}/auth/provider/google/callback`,
      clientId: backendConfig.authentication.providers.google.clientId!,
      clientSecret: backendConfig.authentication.providers.google.clientSecret!,
    })
  }
}
