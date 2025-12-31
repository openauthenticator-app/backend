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
      .bind(session.id, userId, appClientId, sha256(refreshToken, backendConfig.jwtSecrets.refreshPepper))
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
    if (!auth) {
      return null
    }
    const match = auth.match(/^Bearer\s+(.+)$/i)
    const token = match ? match[1] : null
    return token ? Session.fromToken(token, 'access') : null
  }

  static fromToken(token: string, kind?: TokenKind) {
    try {
      const payload = jwt.verify(token, kind === 'refresh' ? backendConfig.jwtSecrets.refresh : backendConfig.jwtSecrets.access) as JwtPayload
      if (typeof payload === 'object' && 'sid' in payload && 'sub' in payload && typeof payload.sub === 'string' && typeof payload.sid === 'string') {
        return new Session((payload as Payload).sid, payload.sub)
      }
    }
    catch { /* empty */ }
    return null
  }

  generateToken(tokenKind?: TokenKind) {
    return jwt.sign(
      { sid: this.id },
      tokenKind === 'refresh' ? backendConfig.jwtSecrets.refresh : backendConfig.jwtSecrets.access,
      { subject: this.userId, expiresIn: (tokenKind === 'refresh' ? backendConfig.ttl.refresh : backendConfig.ttl.access) as StringValue | number },
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
    const tokenHash = sha256(refreshToken, backendConfig.jwtSecrets.refreshPepper)
    const db = useDatabase()
    const row = await db
      .prepare('SELECT appClientId FROM sessions WHERE sessionId = ? AND userId = ? AND tokenHash = ? LIMIT 1')
      .bind(this.id, this.userId, tokenHash)
      .get()

    if (!row || typeof row !== 'object') {
      throw new InvalidSessionError()
    }

    if (appClientId && (row as { appClientId: string }).appClientId !== appClientId) {
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

export class TokensGenerationError extends AppError {
  constructor() {
    super('Failed to generate tokens.')
  }
}

export class SessionCreationError extends AppError {
  constructor() {
    super('Failed to create session.')
  }
}

export class InvalidSessionError extends AppError {
  constructor() {
    super('Invalid session.')
  }
}

export class InvalidAppClientIdError extends AppError {
  constructor() {
    super('Invalid app client ID.', 400)
  }
}

export class TokenRevocationError extends AppError {
  constructor() {
    super('Failed to revoke token.')
  }
}
