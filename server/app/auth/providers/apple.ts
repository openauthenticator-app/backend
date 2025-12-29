import * as arctic from 'arctic'
import { CookieSerializeOptions } from 'cookie-es'
import * as encoding from '@oslojs/encoding'
import { OAuthProvider } from '~/app/auth/providers/provider'
import { H3Event } from 'h3'

export class AppleProvider extends OAuthProvider {
  private apple: arctic.Apple

  constructor() {
    super('apple', false)
    const privateKey = encoding.decodeBase64IgnorePadding(
      backendConfig.authProviders.apple.pemCertificate
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replaceAll('\r', '')
        .replaceAll('\n', '')
        .trim(),
    )
    this.apple = new arctic.Apple(
      backendConfig.authProviders.apple.clientId,
      backendConfig.authProviders.apple.teamId,
      backendConfig.authProviders.apple.keyId,
      privateKey,
      `${backendConfig.url}/auth/provider/apple/callback`,
    )
  }

  protected override createCookieOptions(): CookieSerializeOptions {
    return {
      ...super.createCookieOptions(),
      sameSite: 'none' as CookieSerializeOptions['sameSite'],
    }
  }

  protected override async validateCallbackQueryParameters(event: H3Event, validator: (query: unknown) => boolean): Promise<{ code: string, state: string, mode?: 'login' | 'link' }> {
    const query = await readValidatedBody<{ code: string, state: string, mode?: 'login' | 'link' }>(event, validator)
    return { code: query.code, state: query.state, mode: query.mode }
  }

  override buildRedirectionUrl(state: string): URL {
    const url = this.apple.createAuthorizationURL(
      state,
      [
        // 'email',
        // 'name',
      ],
    )
    url.searchParams.set('prompt', 'select_account')
    url.searchParams.set('response_type', 'code id_token')
    url.searchParams.set('response_mode', 'form_post')
    return url
  }

  protected override validateAuthorizationCode(code: string): Promise<arctic.OAuth2Tokens> {
    return this.apple.validateAuthorizationCode(code)
  }
}
