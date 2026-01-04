import * as arctic from 'arctic'
import { OAuthProvider } from '~/app/auth/providers/provider'

export class GoogleProvider extends OAuthProvider {
  private google: arctic.Google

  constructor() {
    super('google', true)
    assert(!!backendConfig.authentication.providers.google.clientId, 'Missing Google client ID.')
    assert(!!backendConfig.authentication.providers.google.clientSecret, 'Missing Google client secret.')
    this.google = new arctic.Google(
      backendConfig.authentication.providers.google.clientId,
      backendConfig.authentication.providers.google.clientSecret,
      `${backendConfig.url}/auth/provider/google/callback`,
    )
  }

  override buildRedirectionUrl(state: string, codeVerifier: string): URL {
    return this.google.createAuthorizationURL(
      state,
      codeVerifier,
      [
        'openid',
        // 'email',
        // 'profile',
      ],
    )
  }

  protected override validateAuthorizationCode(code: string, codeVerifier: string): Promise<arctic.OAuth2Tokens> {
    return this.google.validateAuthorizationCode(code, codeVerifier)
  }
}
