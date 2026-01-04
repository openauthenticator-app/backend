import jwt, { JwtPayload } from 'jsonwebtoken'
import { H3Event } from 'h3'
import type { StringValue } from 'ms'
import { AppError } from '~/app/error'

type Payload = JwtPayload & { sub: string, sid: string }
type TokenKind = 'access' | 'refresh'

export class Session {
  private readonly id: string
  readonly userId: string

  private constructor(id: string, userId: string) {
    this.id = id
    this.userId = userId
  }

  static async initiate(userId: string, appClientId: string) {
    const session = new Session(generateRandomString(), userId)
    const accessToken = session.generateToken('access')
    const refreshToken = session.generateToken('refresh')
    if (!accessToken || !refreshToken) {
      throw new TokensGenerationError()
    }
    const db = useDatabase()
    const { success } = await db
      .prepare('INSERT INTO sessions (sessionId, userId, appClientId, tokenHash) VALUES (?, ?, ?, ?)')
      .bind(session.id, userId, appClientId, sha256(refreshToken, backendConfig.authentication.jwtSecrets.refreshPepper))
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

  static fromAuthorizationHeader(event: H3Event) {
    const auth = getHeader(event, 'Authorization')
    assert(!!auth, new MissingAuthorizationHeaderError())
    const match = auth.match(/^Bearer\s+(.+)$/i)
    const token = match ? match[1] : null
    if (!token) {
      throw new MalformedAuthorizationHeaderError()
    }
    return Session.fromToken(token, 'access')
  }

  static fromToken(token: string, kind?: TokenKind) {
    let payload
    try {
      payload = jwt.verify(token, kind === 'refresh' ? backendConfig.authentication.jwtSecrets.refresh : backendConfig.authentication.jwtSecrets.access) as JwtPayload
    }
    catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ExpiredSessionError()
      }
      throw new InvalidPayloadError(kind ?? 'access')
    }
    if (typeof payload === 'object' && 'sid' in payload && 'sub' in payload && typeof payload.sub === 'string' && typeof payload.sid === 'string') {
      return new Session((payload as Payload).sid, payload.sub)
    }
    throw new InvalidTokenError(kind ?? 'access')
  }

  generateToken(tokenKind?: TokenKind) {
    return jwt.sign(
      { sid: this.id },
      tokenKind === 'refresh' ? backendConfig.authentication.jwtSecrets.refresh : backendConfig.authentication.jwtSecrets.access,
      { subject: this.userId, expiresIn: (tokenKind === 'refresh' ? backendConfig.authentication.tokensTtl.refresh : backendConfig.authentication.tokensTtl.access) as StringValue | number },
    )
  }

  async refresh(refreshToken: string, appClientId: string) {
    const db = useDatabase()

    await db.prepare('BEGIN').run()
    const rollback = () => db.prepare('ROLLBACK').run()
    try {
      await this.revoke(refreshToken, appClientId)
      const result = await Session.initiate(this.userId, appClientId)
      await db.prepare('COMMIT').run()
      return result
    }
    catch (error) {
      await rollback()
      throw error
    }
  }

  async revoke(refreshToken: string, appClientId?: string) {
    const tokenHash = sha256(refreshToken, backendConfig.authentication.jwtSecrets.refreshPepper)
    const db = useDatabase()
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
    super(`Invalid ${kind} token payload.`, InvalidTokenError, 400)
  }
}

class InvalidTokenError extends AppError {
  constructor(kind: TokenKind) {
    super(`Invalid token : ${kind}.`, InvalidTokenError, 400)
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
