import * as arctic from 'arctic'
import { OAuthProvider } from '~/app/auth/providers/provider'

export class MicrosoftProvider extends OAuthProvider {
  private microsoft: arctic.MicrosoftEntraId

  constructor() {
    super('microsoft', true)
    this.microsoft = new arctic.MicrosoftEntraId(
      backendConfig.authProviders.microsoft.tenantId,
      backendConfig.authProviders.microsoft.clientId,
      backendConfig.authProviders.microsoft.clientSecret,
      `${backendConfig.url}/auth/provider/microsoft/callback`,
    )
  }

  override buildRedirectionUrl(state: string, codeVerifier: string): URL {
    return this.microsoft.createAuthorizationURL(
      state,
      codeVerifier!,
      [
        'openid',
        // 'email',
        // 'profile',
      ],
    )
  }

  protected override validateAuthorizationCode(code: string, codeVerifier: string): Promise<arctic.OAuth2Tokens> {
    return this.microsoft.validateAuthorizationCode(code, codeVerifier)
  }
}
