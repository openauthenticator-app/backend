import * as arctic from 'arctic'
import { CookieSerializeOptions } from 'cookie-es'
import * as encoding from '@oslojs/encoding'
import { OAuthProvider } from '~/app/auth/providers/provider'
import { AppEvent } from '~/app/event'

export class AppleProvider extends OAuthProvider {
  private apple: arctic.Apple

  constructor() {
    super('apple', false)
    assert(!!backendConfig.authentication.providers.apple.pemCertificate, 'Missing Apple PEM certificate.')
    assert(!!backendConfig.authentication.providers.apple.clientId, 'Missing Apple client ID.')
    assert(!!backendConfig.authentication.providers.apple.teamId, 'Missing Apple team ID.')
    assert(!!backendConfig.authentication.providers.apple.keyId, 'Missing Apple key ID.')

    const privateKey = encoding.decodeBase64IgnorePadding(
      backendConfig.authentication.providers.apple.pemCertificate
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replaceAll('\r', '')
        .replaceAll('\n', '')
        .trim(),
    )
    this.apple = new arctic.Apple(
      backendConfig.authentication.providers.apple.clientId,
      backendConfig.authentication.providers.apple.teamId,
      backendConfig.authentication.providers.apple.keyId,
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

  protected override async validateCallbackQueryParameters(event: AppEvent, validator: (query: unknown) => boolean): Promise<{ code: string, state: string, mode?: 'login' | 'link' }> {
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
