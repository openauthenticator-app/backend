import ms, { type StringValue } from 'ms'
import type { AppEvent } from '~/app/event'
import { AppError } from '~/app/error'
import { jwtVerify, SignJWT } from 'jose'
import { JWTExpired } from 'jose/errors'
import type { Database } from 'db0'

type TokenKind = 'access' | 'refresh'

export class Session {
  private readonly id: string
  private readonly appClientId: string
  readonly userId: string

  private constructor(id: string, userId: string, appClientId: string) {
    this.id = id
    this.userId = userId
    this.appClientId = appClientId
  }

  public static async pruneExpired() {
    const db: Database = useDatabaseWithMetadata()
    const result = await db
      .prepare('DELETE FROM sessions WHERE expiration < ?')
      .bind(Date.now())
      .run()

    return !!result.success
  }

  public static async initiate(userId: string, appClientId: string) {
    const session = new Session(generateRandomString(), userId, appClientId)
    const accessToken = await session.generateToken('access')
    const refreshToken = await session.generateToken('refresh')

    if (!accessToken || !refreshToken) {
      throw new TokensGenerationError()
    }

    if (backendConfig.authentication.strategy === 'stateless') {
      return {
        session,
        accessToken,
        refreshToken,
      }
    }

    const expiration = Date.now() + (
      typeof backendConfig.authentication.tokensTtl.refresh === 'number'
        ? backendConfig.authentication.tokensTtl.refresh
        : ms(backendConfig.authentication.tokensTtl.refresh as StringValue)
    )

    const db = useDatabaseWithMetadata()
    const insertResult = await db
      .prepare('INSERT INTO sessions (sessionId, userId, appClientId, tokenHash, expiration) VALUES (?, ?, ?, ?, ?)')
      .bind(
        session.id,
        userId,
        appClientId,
        sha256(refreshToken, backendConfig.authentication.jwtSecrets.refreshPepper),
        expiration,
      )
      .run()

    if (!hasExactlyOneChange(insertResult)) {
      throw new SessionCreationError()
    }

    return {
      session,
      accessToken,
      refreshToken,
    }
  }

  public static async readAndVerifyFromAuthorizationHeader(event: AppEvent) {
    const auth = event.req.headers.get('Authorization')
    assert(!!auth, new MissingAuthorizationHeaderError())

    const match = auth.match(/^Bearer\s+(.+)$/i)
    const token = match ? match[1] : null
    if (!token) {
      throw new MalformedAuthorizationHeaderError()
    }

    const session = await Session.decodeVerifiedToken(token, 'access')
    session.assertAppClientId(event.context.appClientId)
    if (backendConfig.authentication.strategy === 'stateful') {
      await session.assertActive(event.context.appClientId)
    }
    return session
  }

  public static async decodeVerifiedToken(token: string, kind?: TokenKind) {
    kind ??= 'access'
    let payload
    try {
      const secret = new TextEncoder()
        .encode(kind === 'refresh' ? backendConfig.authentication.jwtSecrets.refresh : backendConfig.authentication.jwtSecrets.access)
      const result = await jwtVerify(token, secret, { algorithms: ['HS256'] })
      payload = result.payload
    }
    catch (error) {
      if (error instanceof JWTExpired) {
        throw new ExpiredSessionError()
      }
      throw new InvalidTokenError(kind)
    }

    if (
      payload
      && typeof payload === 'object'
      && 'sid' in payload
      && 'sub' in payload
      && 'typ' in payload
      && 'aci' in payload
      && typeof payload.sub === 'string'
      && typeof payload.sid === 'string'
      && typeof payload.typ === 'string'
      && typeof payload.aci === 'string'
      && payload.typ === kind
    ) {
      return new Session(payload.sid, payload.sub, payload.aci)
    }

    throw new InvalidPayloadError(kind)
  }

  private async generateToken(tokenKind?: TokenKind) {
    tokenKind ??= 'access'
    const secret = new TextEncoder()
      .encode(tokenKind === 'refresh' ? backendConfig.authentication.jwtSecrets.refresh : backendConfig.authentication.jwtSecrets.access)

    return await new SignJWT({ sid: this.id, typ: tokenKind, aci: this.appClientId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(tokenKind === 'refresh' ? backendConfig.authentication.tokensTtl.refresh : backendConfig.authentication.tokensTtl.access)
      .setSubject(this.userId)
      .sign(secret)
  }

  public async refresh(refreshToken: string, appClientId: string) {
    await this.revoke(refreshToken, appClientId)
    return await Session.initiate(this.userId, appClientId)
  }

  private async assertActive(appClientId: string) {
    const db = useDatabaseWithMetadata()
    const dbSession = (await db
      .prepare('SELECT appClientId, expiration FROM sessions WHERE sessionId = ? AND userId = ? LIMIT 1')
      .bind(this.id, this.userId)
      .get()) as DbSessionWithExpiration | undefined

    if (!dbSession || dbSession.expiration < Date.now()) {
      throw new InvalidSessionError()
    }

    if (dbSession.appClientId !== appClientId) {
      throw new InvalidAppClientIdError()
    }
  }

  public async revoke(refreshToken: string, appClientId: string) {
    this.assertAppClientId(appClientId)
    if (backendConfig.authentication.strategy === 'stateless') {
      return
    }

    const tokenHash = sha256(refreshToken, backendConfig.authentication.jwtSecrets.refreshPepper)
    const db = useDatabaseWithMetadata()

    const dbSession = (await db
      .prepare('SELECT appClientId FROM sessions WHERE sessionId = ? AND userId = ? AND tokenHash = ? LIMIT 1')
      .bind(this.id, this.userId, tokenHash)
      .get()) as DbSession | undefined

    if (!dbSession) {
      throw new InvalidSessionError()
    }

    if (dbSession.appClientId !== appClientId) {
      throw new InvalidAppClientIdError()
    }

    const deleteResult = await db
      .prepare('DELETE FROM sessions WHERE sessionId = ? AND userId = ? AND tokenHash = ?')
      .bind(this.id, this.userId, tokenHash)
      .run()

    if (!hasExactlyOneChange(deleteResult)) {
      throw new TokenRevocationError()
    }
  }

  private assertAppClientId(appClientId: string) {
    if (this.appClientId !== appClientId) {
      throw new InvalidAppClientIdError()
    }
  }
}

interface DbSession {
  sessionId: string
  userId: string
  appClientId: string
  tokenHash: string
}

interface DbSessionWithExpiration {
  appClientId: string
  expiration: number
}

class MissingAuthorizationHeaderError extends AppError {
  constructor() {
    super('Missing Authorization header.', MissingAuthorizationHeaderError, 401)
  }
}

class MalformedAuthorizationHeaderError extends AppError {
  constructor() {
    super('Malformed Authorization header.', MalformedAuthorizationHeaderError, 400)
  }
}

class TokensGenerationError extends AppError {
  constructor() {
    super('Failed to generate tokens.', TokensGenerationError)
  }
}

class SessionCreationError extends AppError {
  constructor() {
    super('Failed to create session.', SessionCreationError)
  }
}

class InvalidSessionError extends AppError {
  constructor() {
    super('Invalid session.', InvalidSessionError)
  }
}

class ExpiredSessionError extends AppError {
  constructor() {
    super('Session expired.', ExpiredSessionError, 401)
  }
}

class InvalidPayloadError extends AppError {
  constructor(kind: TokenKind) {
    super(`Invalid ${kind} token payload.`, InvalidPayloadError, 400)
  }
}

class InvalidTokenError extends AppError {
  constructor(kind: TokenKind) {
    super(`Invalid ${kind} token provided.`, InvalidTokenError, 400)
  }
}

class InvalidAppClientIdError extends AppError {
  constructor() {
    super('Invalid app client ID.', InvalidAppClientIdError, 400)
  }
}

class TokenRevocationError extends AppError {
  constructor() {
    super('Failed to revoke token.', TokenRevocationError)
  }
}
