import backendConfig from '~/backend.config'
import { assert } from '~/utils/utils'
import { createAuthorizationUrl, exchangeAuthorizationCode, type OAuthTokens } from '~/app/auth/oauth'
import { OAuthProvider } from '~/app/auth/providers/provider'

export class MicrosoftProvider extends OAuthProvider {
  constructor() {
    super('microsoft', true)
    assert(!!backendConfig.authentication.providers.microsoft.tenantId, 'Missing Microsoft tenant ID.')
    assert(!!backendConfig.authentication.providers.microsoft.clientId, 'Missing Microsoft client ID.')
    assert(!!backendConfig.authentication.providers.microsoft.clientSecret, 'Missing Microsoft client secret.')
  }

  override buildRedirectionUrl(state: string, codeVerifier: string): Promise<URL> {
    return createAuthorizationUrl(
      `https://login.microsoftonline.com/${encodeURIComponent(backendConfig.authentication.providers.microsoft.tenantId!)}/oauth2/v2.0/authorize`,
      backendConfig.authentication.providers.microsoft.clientId!,
      `${backendConfig.url}/auth/provider/microsoft/callback`,
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
      endpoint: `https://login.microsoftonline.com/${encodeURIComponent(backendConfig.authentication.providers.microsoft.tenantId!)}/oauth2/v2.0/token`,
      code,
      codeVerifier,
      redirectUri: `${backendConfig.url}/auth/provider/microsoft/callback`,
      clientId: backendConfig.authentication.providers.microsoft.clientId!,
      clientSecret: backendConfig.authentication.providers.microsoft.clientSecret!,
    })
  }
}
