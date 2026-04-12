import * as arctic from 'arctic'
import { AppError } from '~/app/error'
import { Session } from '~/app/auth/session'
import { User } from '~/app/user'
import type { AppEvent } from '~/app/event'
import { deleteCookie, getCookie, getValidatedQuery, type H3Event, readValidatedBody, setCookie } from 'nitro/h3'

export type Mode = 'login' | 'link'

export abstract class AuthProvider {
  public readonly id: string

  protected constructor(id: AuthProviderId) {
    this.id = id
  }

  public abstract redirect(event: AppEvent): Promise<URL>

  public abstract callback(event: AppEvent): ReturnType<typeof this.getCallbackRedirectUrl>

  protected async getCallbackRedirectUrl(authorizationCode: string, additionalQueryParams?: Record<string, string>): Promise<URL> {
    const url: URL = new URL(`openauthenticator://auth/provider/${this.id}/finish`)
    url.searchParams.append('authorizationCode', authorizationCode)
    if (additionalQueryParams) {
      for (const [key, value] of Object.entries(additionalQueryParams)) {
        url.searchParams.append(key, value)
      }
    }
    return url
  }

  public async login(event: AppEvent): ReturnType<typeof this.finishLogin> {
    const providerUserId = await this.validateLogin(event)
    return await this.finishLogin(event, providerUserId)
  }

  public async link(event: AppEvent): ReturnType<typeof this.finishLink> {
    const providerUserId = await this.validateLogin(event)
    return await this.finishLink(event, providerUserId)
  }

  protected abstract validateLogin(event: AppEvent): Promise<string>

  protected async finishLogin(event: AppEvent, providerUserId: string): Promise<{ accessToken: string, refreshToken: string }> {
    const idInUser = User.getAuthProviderFieldName(this)
    let user = await User.findInDatabase({ [idInUser]: providerUserId })
    if (!user) {
      if (!backendConfig.enableRegistrations) {
        throw new RegistrationsDisabledError()
      }
      user = await User.createInDatabase({ [idInUser]: providerUserId })
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

  protected async finishLink(event: AppEvent, providerUserId: string): Promise<{ userId: string, providerUserId: string }> {
    const currentUser = await useUser(event)
    const idInUser = User.getAuthProviderFieldName(this)
    const existingUser = await User.findInDatabase({ [idInUser]: providerUserId })
    if (existingUser?.id === currentUser.id) {
      return {
        userId: currentUser.id,
        providerUserId,
      }
    }
    if (existingUser) {
      throw new ProviderUserAlreadyExistsError()
    }
    await currentUser?.updateInDatabase({ [idInUser]: providerUserId })
    return {
      userId: currentUser.id,
      providerUserId,
    }
  }

  public async unlink(event: AppEvent): Promise<void> {
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
      ...backendConfig.authentication.cookiesOptions,
    }
  }

  abstract buildRedirectionUrl(state?: string, codeVerifier?: string): URL

  public override async redirect(event: AppEvent) {
    const validateQuery = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if ('mode' in query) {
        if (query.mode !== 'login' && query.mode !== 'link') {
          return false
        }
        if (query.mode === 'link' && !('userId' in query && typeof query.userId === 'string')) {
          return false
        }
      }
      return true
    }
    const { mode, userId } = await getValidatedQuery<H3Event, { mode?: Mode, userId?: string }>(event, validateQuery)
    if (mode === 'link') {
      const user = await User.findInDatabase({ id: userId })
      if (!user) {
        throw new UserNotFoundByIdError()
      }
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
    return this.buildRedirectionUrl(state, codeVerifier)
  }

  protected async validateCallbackQueryParameters(event: AppEvent, validator: (query: unknown) => boolean): Promise<{ code: string, state: string }> {
    const query = await getValidatedQuery<H3Event, { code: string, state: string }>(event, validator)
    return { code: query.code, state: query.state }
  }

  public override async callback(event: AppEvent) {
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
    return this.getCallbackRedirectUrl(parameters.code, this.needsCodeVerifier ? { codeVerifier: codeVerifier! } : undefined)
  }

  protected abstract validateAuthorizationCode(code: string, codeVerifier?: string): Promise<arctic.OAuth2Tokens>

  protected override async validateLogin(event: AppEvent) {
    const validateBody = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      return 'authorizationCode' in query && typeof query.authorizationCode === 'string'
    }
    const { authorizationCode, codeVerifier } = await readValidatedBody<H3Event, { authorizationCode: string, codeVerifier?: string }>(event, validateBody)
    let tokens: arctic.OAuth2Tokens
    try {
      tokens = await this.validateAuthorizationCode(authorizationCode, codeVerifier)
    }
    catch {
      throw new InvalidAuthorizationCodeError()
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

export interface CookieSerializeOptions {
  domain?: string | undefined
  encode?(value: string): string
  expires?: Date | undefined
  httpOnly?: boolean | undefined
  maxAge?: number | undefined
  path?: string | undefined
  priority?: 'low' | 'medium' | 'high' | undefined
  sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined
  secure?: boolean | undefined
  partitioned?: boolean
}

class RegistrationsDisabledError extends AppError {
  constructor() {
    super('Registrations are disabled.', RegistrationsDisabledError, 403)
  }
}

class UserNotFoundByIdError extends AppError {
  constructor() {
    super(`No user found matching the given identifier.`, UserNotFoundByIdError, 404)
  }
}

export class ProviderAlreadyLinkedError extends AppError {
  constructor() {
    super('Provider already linked.', ProviderAlreadyLinkedError, 400)
  }
}

class NoCodeVerifierFoundError extends AppError {
  constructor() {
    super('No code verifier found.', NoCodeVerifierFoundError, 401)
  }
}

class NoStateFoundError extends AppError {
  constructor() {
    super('No state found.', NoStateFoundError, 401)
  }
}

class InvalidStateError extends AppError {
  constructor() {
    super('Invalid state.', InvalidStateError, 400)
  }
}

export class InvalidAuthorizationCodeError extends AppError {
  constructor() {
    super('Invalid authorization code.', InvalidAuthorizationCodeError, 400)
  }
}

class IdTokenDecodeFailedError extends AppError {
  constructor() {
    super('Failed to decode ID token.', IdTokenDecodeFailedError)
  }
}

class UserCreationFailedError extends AppError {
  constructor() {
    super('Failed to create user.', UserCreationFailedError)
  }
}

class ProviderUserAlreadyExistsError extends AppError {
  constructor() {
    super('An user with this provider already exists.', ProviderUserAlreadyExistsError, 400)
  }
}

class CannotUnlinkLastProviderError extends AppError {
  constructor() {
    super('You cannot unlink the last provider linked to this account.', CannotUnlinkLastProviderError, 400)
  }
}
