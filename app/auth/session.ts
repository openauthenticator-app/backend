import type { H3Event } from 'nitro/h3'
import ms, { type StringValue } from 'ms'
import { AppError } from '~/app/error'
import { jwtVerify, SignJWT } from 'jose'
import { JWTExpired } from 'jose/errors'
import type { Database } from 'db0'

type TokenKind = 'access' | 'refresh'

export class Session {
  private readonly id: string
  readonly userId: string

  private constructor(id: string, userId: string) {
    this.id = id
    this.userId = userId
  }

  static async pruneExpired() {
    const db: Database = useDatabase()
    const { success } = await db
      .prepare('DELETE FROM sessions WHERE expiration < ?')
      .bind(Date.now())
      .run()
    return success
  }

  static async initiate(userId: string, appClientId: string) {
    const session = new Session(generateRandomString(), userId)
    const accessToken = await session.generateToken('access')
    const refreshToken = await session.generateToken('refresh')
    if (!accessToken || !refreshToken) {
      throw new TokensGenerationError()
    }
    const expiration = Date.now() + (typeof backendConfig.authentication.tokensTtl.refresh === 'number' ? backendConfig.authentication.tokensTtl.refresh : ms(backendConfig.authentication.tokensTtl.refresh as StringValue))
    const db: Database = useDatabase()
    const { success } = await db
      .prepare('INSERT INTO sessions (sessionId, userId, appClientId, tokenHash, expiration) VALUES (?, ?, ?, ?, ?)')
      .bind(session.id, userId, appClientId, sha256(refreshToken, backendConfig.authentication.jwtSecrets.refreshPepper), expiration)
      .run()

    if (!success) {
      throw new SessionCreationError()
    }
    return {
      session,
      accessToken,
      refreshToken,
    }
  }

  static async fromAuthorizationHeader(event: H3Event) {
    const auth = event.req.headers.get('Authorization')
    assert(!!auth, new MissingAuthorizationHeaderError())
    const match = auth.match(/^Bearer\s+(.+)$/i)
    const token = match ? match[1] : null
    if (!token) {
      throw new MalformedAuthorizationHeaderError()
    }
    return await Session.fromToken(token, 'access')
  }

  static async fromToken(token: string, kind?: TokenKind) {
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
      throw new InvalidPayloadError(kind ?? 'access')
    }
    if (payload && typeof payload === 'object' && 'sid' in payload && 'sub' in payload && typeof payload.sub === 'string' && typeof payload.sid === 'string') {
      return new Session(payload.sid, payload.sub)
    }
    throw new InvalidTokenError(kind ?? 'access')
  }

  private async generateToken(tokenKind?: TokenKind) {
    const secret = new TextEncoder()
      .encode(tokenKind === 'refresh' ? backendConfig.authentication.jwtSecrets.refresh : backendConfig.authentication.jwtSecrets.access)
    return await new SignJWT({ sid: this.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(tokenKind === 'refresh' ? backendConfig.authentication.tokensTtl.refresh : backendConfig.authentication.tokensTtl.access)
      .setSubject(this.userId)
      .sign(secret)
  }

  async refresh(refreshToken: string, appClientId: string) {
    await this.revoke(refreshToken, appClientId)
    return await Session.initiate(this.userId, appClientId)
  }

  async revoke(refreshToken: string, appClientId?: string) {
    const tokenHash = sha256(refreshToken, backendConfig.authentication.jwtSecrets.refreshPepper)
    const db: Database = useDatabase()
    const dbSession = (await db
      .prepare('SELECT appClientId FROM sessions WHERE sessionId = ? AND userId = ? AND tokenHash = ? LIMIT 1')
      .bind(this.id, this.userId, tokenHash)
      .get()) as DbSession | undefined

    if (!dbSession) {
      throw new InvalidSessionError()
    }

    if (appClientId && dbSession.appClientId !== appClientId) {
      throw new InvalidAppClientIdError()
    }

    const { success } = await db
      .prepare('DELETE FROM sessions WHERE sessionId = ? AND userId = ? AND tokenHash = ?')
      .bind(this.id, this.userId, tokenHash)
      .run()
    if (!success) {
      throw new TokenRevocationError()
    }
  }
}

interface DbSession {
  sessionId: string
  userId: string
  appClientId: string
  tokenHash: string
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
