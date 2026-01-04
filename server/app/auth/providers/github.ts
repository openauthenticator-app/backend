import * as arctic from 'arctic'
import { OAuthProvider } from '~/app/auth/providers/provider'

export class GithubProvider extends OAuthProvider {
  private github: arctic.GitHub

  constructor() {
    super('github', false)
    assert(!!backendConfig.authentication.providers.github.clientId, 'Missing GitHub client ID.')
    assert(!!backendConfig.authentication.providers.github.clientSecret, 'Missing GitHub client secret.')
    this.github = new arctic.GitHub(
      backendConfig.authentication.providers.github.clientId,
      backendConfig.authentication.providers.github.clientSecret,
      `${backendConfig.url}/auth/provider/github/callback`,
    )
  }

  override buildRedirectionUrl(state: string): URL {
    return this.github.createAuthorizationURL(
      state,
      [
        'read:user',
        // 'user:email',
      ],
    )
  }

  protected override async findId(tokens: arctic.OAuth2Tokens): Promise<{ id: string }> {
    const accessToken = tokens.accessToken()
    const githubUser = await $fetch<{
      id: number
      email: string | null
    }>(
      'https://api.github.com/user',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'OpenAuthenticator',
        },
      },
    )

    return {
      id: githubUser.id.toString(),
    }
  }

  protected override validateAuthorizationCode(code: string): Promise<arctic.OAuth2Tokens> {
    return this.github.validateAuthorizationCode(code)
  }
}
