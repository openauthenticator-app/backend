import backendConfig from '~/backend.config'
import { assert } from '~/utils/utils'
import pkg from '~/package.json' with { type: 'json' }
import { createAuthorizationUrl, exchangeAuthorizationCode, type OAuthTokens } from '~/app/auth/oauth'
import { OAuthProvider } from '~/app/auth/providers/provider'
import { fetch } from 'nitro'

export class GithubProvider extends OAuthProvider {
  constructor() {
    super('github', false)
    assert(!!backendConfig.authentication.providers.github.clientId, 'Missing GitHub client ID.')
    assert(!!backendConfig.authentication.providers.github.clientSecret, 'Missing GitHub client secret.')
  }

  override buildRedirectionUrl(state: string): Promise<URL> {
    return createAuthorizationUrl(
      'https://github.com/login/oauth/authorize',
      backendConfig.authentication.providers.github.clientId!,
      `${backendConfig.url}/auth/provider/github/callback`,
      state,
      [
        'read:user',
        // 'user:email',
      ],
    )
  }

  protected override async findId(tokens: OAuthTokens): Promise<{ id: string }> {
    const accessToken = tokens.accessToken
    const response = await fetch(
      'https://api.github.com/user',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': pkg.name,
        },
      },
    )

    const githubUser = await response.json() as {
      id: number
      email: string | null
    }
    return {
      id: githubUser.id.toString(),
    }
  }

  protected override validateAuthorizationCode(code: string): Promise<OAuthTokens> {
    return exchangeAuthorizationCode({
      endpoint: 'https://github.com/login/oauth/access_token',
      code,
      redirectUri: `${backendConfig.url}/auth/provider/github/callback`,
      clientId: backendConfig.authentication.providers.github.clientId!,
      clientSecret: backendConfig.authentication.providers.github.clientSecret!,
    })
  }
}
