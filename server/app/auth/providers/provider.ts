import * as arctic from 'arctic'
import { CookieSerializeOptions } from 'cookie-es'
import { AppError } from '~/app/error'
import { Session } from '~/app/auth/session'
import { User } from '~/app/user'
import { AppProviderEvent, ProviderEvent } from '~/app/event'

export type Mode = 'login' | 'link'

export abstract class AuthProvider {
  public readonly id: string

  protected constructor(id: AuthProviderId) {
    this.id = id
  }

  public abstract redirect(event: AppProviderEvent): Promise<void>

  public abstract callback(event: ProviderEvent): ReturnType<typeof this.redirectIntoApp>

  protected redirectIntoApp(event: ProviderEvent, authorizationCode: string, additionalQueryParams?: Record<string, string>) {
    const url: URL = new URL(`/auth/provider/${this.id}/code`)
    url.protocol = 'openauthenticator:'
    url.searchParams.append('authorizationCode', authorizationCode)
    if (additionalQueryParams) {
      for (const [key, value] of Object.entries(additionalQueryParams)) {
        url.searchParams.append(key, value)
      }
    }
    return sendRedirect(event, url.toString())
  }

  public async login(event: AppProviderEvent): ReturnType<typeof this.finishLogin> {
    const providerId = await this.validateLogin(event)
    return await this.finishLogin(event, providerId)
  }

  public async link(event: AppProviderEvent): ReturnType<typeof this.finishLink> {
    const providerId = await this.validateLogin(event)
    return await this.finishLink(event, providerId)
  }

  protected abstract validateLogin(event: AppProviderEvent): Promise<string>

  protected async finishLogin(event: AppProviderEvent, providerId: string): Promise<{ accessToken: string, refreshToken: string }> {
    const idInUser = User.getAuthProviderFieldName(this)
    let user = await User.findInDatabase({ [idInUser]: providerId })
    if (!user) {
      user = await User.createInDatabase({ [idInUser]: providerId })
      if (!user) {
        throw new UserCreationFailedError()
      }
    }
    const { accessToken, refreshToken } = await Session.initiate(user.id, event.context.appClientId)
    return {
      accessToken,
      refreshToken,
    }
  }

  protected async finishLink(event: AppProviderEvent, providerId: string): Promise<void> {
    const currentUser = await useUser(event)
    const idInUser = User.getAuthProviderFieldName(this)
    const existingUser = await User.findInDatabase({ [idInUser]: providerId })
    if (existingUser?.id === currentUser.id) {
      return
    }
    if (existingUser) {
      throw new ProviderUserAlreadyExistsError()
    }
    await currentUser?.updateInDatabase({ [idInUser]: providerId })
  }

  public async unlink(event: AppProviderEvent): Promise<void> {
    const user = await useUser(event)
    if (user.hasProvider(this)) {
      if (user.getProviderCount() <= 1) {
        throw new CannotUnlinkLastProviderError()
      }
      const idInUser = User.getAuthProviderFieldName(this)
      await user.updateInDatabase({
        [idInUser]: null,
      })
    }
  }
}

export abstract class OAuthProvider extends AuthProvider {
  private readonly needsCodeVerifier: boolean

  protected constructor(id: AuthProviderId, needsCodeVerifier: boolean) {
    super(id)
    this.needsCodeVerifier = needsCodeVerifier
  }

  protected createCookieOptions(): CookieSerializeOptions {
    return {
      path: backendConfig.cookies.path,
      httpOnly: backendConfig.cookies.httpOnly,
      secure: backendConfig.cookies.secure,
      maxAge: backendConfig.cookies.maxAge,
      sameSite: backendConfig.cookies.sameSite as CookieSerializeOptions['sameSite'],
    }
  }

  abstract buildRedirectionUrl(state?: string, codeVerifier?: string): URL

  public override async redirect(event: AppProviderEvent) {
    const validateQuery = (query: unknown): boolean => typeof query === 'object'
    const { mode } = await getValidatedQuery<{ mode?: Mode }>(event, validateQuery)
    if (mode === 'link') {
      const user = await useUser(event)
      if (user.hasProvider(this)) {
        throw new ProviderAlreadyLinkedError()
      }
    }
    const cookieOptions: CookieSerializeOptions = this.createCookieOptions()
    const state = arctic.generateState()
    setCookie(event, `${this.id}_auth_state`, state, cookieOptions)
    let codeVerifier: string | undefined
    if (this.needsCodeVerifier) {
      codeVerifier = arctic.generateCodeVerifier()
      setCookie(event, `${this.id}_auth_code_verifier`, codeVerifier, cookieOptions)
    }
    return await sendRedirect(event, this.buildRedirectionUrl(state, codeVerifier).toString())
  }

  protected async validateCallbackQueryParameters(event: ProviderEvent, validator: (query: unknown) => boolean): Promise<{ code: string, state: string }> {
    const query = await getValidatedQuery<{ code: string, state: string }>(event, validator)
    return { code: query.code, state: query.state }
  }

  public override async callback(event: ProviderEvent) {
    let codeVerifier: string | undefined
    if (this.needsCodeVerifier) {
      codeVerifier = getCookie(event, `${this.id}_auth_code_verifier`)
      if (!codeVerifier) {
        throw new NoCodeVerifierFoundError()
      }
    }
    const storedState = getCookie(event, `${this.id}_auth_state`)
    if (!storedState) {
      throw new NoStateFoundError()
    }
    const validator = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      return 'code' in query && typeof query.code === 'string' && 'state' in query && typeof query.state === 'string'
    }
    const parameters = await this.validateCallbackQueryParameters(event, validator)
    if (parameters.state !== storedState) {
      throw new InvalidStateError()
    }
    deleteCookie(event, `${this.id}_auth_state`)
    if (this.needsCodeVerifier) {
      deleteCookie(event, `${this.id}_auth_code_verifier`)
    }
    return await this.redirectIntoApp(event, parameters.code, this.needsCodeVerifier ? { codeVerifier: codeVerifier! } : undefined)
  }

  protected abstract validateAuthorizationCode(code: string, codeVerifier?: string): Promise<arctic.OAuth2Tokens>

  protected override async validateLogin(event: AppProviderEvent) {
    const validateBody = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      return 'authorizationCode' in query && typeof query.authorizationCode === 'string'
    }
    const { authorizationCode, codeVerifier } = await readValidatedBody<{ authorizationCode: string, codeVerifier?: string }>(event, validateBody)
    let tokens: arctic.OAuth2Tokens
    try {
      tokens = await this.validateAuthorizationCode(authorizationCode, codeVerifier)
    }
    catch {
      throw new InvalidCodeError()
    }
    const { id } = await this.findId(tokens)
    return id
  }

  protected async findId(tokens: arctic.OAuth2Tokens): Promise<{ id: string }> {
    const claims = arctic.decodeIdToken(tokens.idToken())
    if (!claims || typeof claims !== 'object' || !('sub' in claims) || typeof claims.sub !== 'string') {
      throw new IdTokenDecodeFailedError()
    }
    return { id: claims.sub }
  }
}

export class ProviderAlreadyLinkedError extends AppError {
  constructor() {
    super('Provider already linked.', 400)
  }
}

export class NoCodeVerifierFoundError extends AppError {
  constructor() {
    super('No code verifier found.', 401)
  }
}

export class NoStateFoundError extends AppError {
  constructor() {
    super('No state found.', 401)
  }
}

export class InvalidStateError extends AppError {
  constructor() {
    super('Invalid state.', 400)
  }
}

export class InvalidCodeError extends AppError {
  constructor() {
    super('Invalid code.', 400)
  }
}

export class IdTokenDecodeFailedError extends AppError {
  constructor() {
    super('Failed to decode ID token.')
  }
}

export class UserCreationFailedError extends AppError {
  constructor() {
    super('Failed to create user.')
  }
}

export class ProviderUserAlreadyExistsError extends AppError {
  constructor() {
    super('An user with this provider already exists.', 400)
  }
}

export class CannotUnlinkLastProviderError extends AppError {
  constructor() {
    super('You cannot unlink the last provider linked to this account.', 400)
  }
}
