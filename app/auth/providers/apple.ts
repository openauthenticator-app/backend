import backendConfig from '~/backend.config'
import { assert } from '~/utils/utils'
import {
  createAppleClientSecret,
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  type OAuthTokens
} from '~/app/auth/oauth'
import { type CookieSerializeOptions, OAuthProvider } from '~/app/auth/providers/provider'
import type { AppEvent } from '~/app/event'
import { type H3Event, readValidatedBody } from 'nitro/h3'

export class AppleProvider extends OAuthProvider {
  constructor() {
    super('apple', false)
    assert(!!backendConfig.authentication.providers.apple.pemCertificate, 'Missing Apple PEM certificate.')
    assert(!!backendConfig.authentication.providers.apple.clientId, 'Missing Apple client ID.')
    assert(!!backendConfig.authentication.providers.apple.teamId, 'Missing Apple team ID.')
    assert(!!backendConfig.authentication.providers.apple.keyId, 'Missing Apple key ID.')
  }

  protected override createCookieOptions(): CookieSerializeOptions {
    return {
      ...super.createCookieOptions(),
      sameSite: 'none' as CookieSerializeOptions['sameSite'],
    }
  }

  protected override async validateCallbackQueryParameters(event: AppEvent, validator: (query: unknown) => boolean): Promise<{ code: string, state: string, mode?: 'login' | 'link' }> {
    const query = await readValidatedBody<H3Event, { code: string, state: string, mode?: 'login' | 'link' }>(event, validator)
    return { code: query.code, state: query.state, mode: query.mode }
  }

  override async buildRedirectionUrl(state: string): Promise<URL> {
    const url = await createAuthorizationUrl(
      'https://appleid.apple.com/auth/authorize',
      backendConfig.authentication.providers.apple.clientId!,
      `${backendConfig.url}/auth/provider/apple/callback`,
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

  protected override async validateAuthorizationCode(code: string): Promise<OAuthTokens> {
    const config = backendConfig.authentication.providers.apple
    const clientSecret = await createAppleClientSecret(config.pemCertificate!, config.teamId!, config.keyId!, config.clientId!)
    return exchangeAuthorizationCode({
      endpoint: 'https://appleid.apple.com/auth/token',
      code,
      redirectUri: `${backendConfig.url}/auth/provider/apple/callback`,
      clientId: config.clientId!,
      clientSecret,
      authentication: 'body',
    })
  }
}
