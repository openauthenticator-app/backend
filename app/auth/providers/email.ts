import {
  AuthProvider,
  InvalidAuthorizationCodeError,
  type Mode,
  ProviderAlreadyLinkedError,
} from '~/app/auth/providers/provider'
import type { AppEvent } from '~/app/event'
import { AppError } from '~/app/error'
import { Mailer } from '~/app/email'
import { User } from '~/app/user'
import crypto from 'node:crypto'
import { getValidatedQuery, type H3Event, readValidatedBody } from 'nitro/h3'

export class EmailProvider extends AuthProvider {
  constructor() {
    super('email')
  }

  public async cancel(event: AppEvent) {
    const validateBody = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if (!('cancelCode' in query) || typeof query.cancelCode !== 'string') {
        return false
      }
      if (!('email' in query) || typeof query.email !== 'string') {
        return false
      }
      return isValidEmail(query.email)
    }

    const { email: rawEmail, cancelCode } = await readValidatedBody<H3Event, { email: string, cancelCode: string }>(event, validateBody)
    const email = this.normalizeEmail(rawEmail)

    const db = useDatabaseWithMetadata()
    const verification = (await db
      .prepare('SELECT * FROM emailVerifications WHERE email = ? AND cancelCode = ? LIMIT 1')
      .bind(email, cancelCode)
      .get()) as DbEmailVerification | undefined

    if (verification) {
      await this.deleteVerification(email, { cancelCode })
    }
  }

  public override async redirect(event: AppEvent) {
    const validateBody = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if (!('mode' in query) || (query.mode !== 'login' && query.mode !== 'link')) {
        return false
      }
      if (query.mode === 'link' && !('userId' in query && typeof query.userId === 'string')) {
        return false
      }
      if (!('email' in query) || typeof query.email !== 'string') {
        return false
      }
      if ('locale' in query && (typeof query.locale !== 'string' || !/^[A-Za-z]{2,4}([_-][A-Za-z]{4})?([_-]([A-Za-z]{2}|[0-9]{3}))?$/.test(query.locale))) {
        return false
      }
      return isValidEmail(query.email)
    }

    const { email: unnormalizedEmail, mode, locale, userId: providerUserId } = await getValidatedQuery<H3Event, { email: string, mode: Mode, locale: string | undefined, userId?: string }>(event, validateBody)
    const email = this.normalizeEmail(unnormalizedEmail)

    let userId: string | null = null
    if (mode === 'link') {
      const user = await User.findInDatabase({ id: providerUserId })
      if (!user) {
        throw new UserNotFoundByIdError()
      }
      if (user.hasProvider(this)) {
        throw new ProviderAlreadyLinkedError()
      }
      userId = user.id
    }

    const db = useDatabaseWithMetadata()

    if (userId) {
      const userPendingDbVerification = (await db
        .prepare('SELECT * FROM emailVerifications WHERE userId = ? LIMIT 1')
        .bind(userId)
        .get()) as DbEmailVerification | undefined

      if (userPendingDbVerification) {
        if (!this.hasExpired(userPendingDbVerification)) {
          throw new UserHasPendingVerificationError()
        }
        await this.deleteVerification(userPendingDbVerification.email, { userId })
      }
    }

    const emailPendingDbVerification = (await db
      .prepare('SELECT * FROM emailVerifications WHERE email = ? LIMIT 1')
      .bind(email)
      .get()) as DbEmailVerification | undefined

    const url: URL = new URL('openauthenticator://auth/provider/email/sent')
    url.searchParams.append('email', email)

    let sendVerificationMail = !emailPendingDbVerification
    if (emailPendingDbVerification) {
      url.searchParams.append('previously', 'true')

      if (this.hasExpired(emailPendingDbVerification)) {
        await this.deleteVerification(email)
        sendVerificationMail = true
      }
    }

    if (sendVerificationMail) {
      const generateCode = () => {
        const alphabet = '0123456789ABCDEFGHIJLMNOPQRSTUVWXYZ'
        let result = ''
        for (let i = 0; i < 6; i++) {
          result += alphabet[crypto.randomInt(alphabet.length)]
        }
        return result
      }

      const verificationCode = generateCode()
      const verificationCodeExpiration = Date.now() + 10 * 60 * 1000
      const cancelCode = generateRandomString()
      url.searchParams.append('cancelCode', cancelCode)

      const insertResult = await db
        .prepare('INSERT INTO emailVerifications (email, userId, verificationCode, verificationCodeExpiration, cancelCode) VALUES (?, ?, ?, ?, ?)')
        .bind(email, userId, verificationCode, verificationCodeExpiration, cancelCode)
        .run()

      if (!hasExactlyOneChange(insertResult)) {
        throw new VerificationCreationFailedError()
      }

      await this.sendEmail(email, verificationCode, locale)
    }

    return url
  }

  private async sendEmail(email: string, verificationCode: string, locale?: string) {
    const magicLink: URL = new URL('/auth/provider/email/callback', backendConfig.url)
    magicLink.searchParams.append('verificationCode', verificationCode)
    magicLink.searchParams.append('email', email)

    if (process.env.NODE_ENV === 'development') {
      console.log(`Sending email to ${email} with verification code ${verificationCode}...`)
    }
    else {
      const mailer = await Mailer.getBackendConfigMailer()
      await mailer.sendVerificationCode(email, verificationCode, magicLink.toString(), locale)
    }
  }

  public override async callback(event: AppEvent) {
    const validateQuery = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if (!('verificationCode' in query) || typeof query.verificationCode !== 'string') {
        return false
      }
      if (!('email' in query) || typeof query.email !== 'string') {
        return false
      }
      return isValidEmail(query.email)
    }

    let email: string
    let verificationCode: string

    if (event.req.method === 'POST') {
      const result = await readValidatedBody<H3Event, { email: string, verificationCode: string }>(event, validateQuery)
      email = this.normalizeEmail(result.email)
      verificationCode = result.verificationCode
    }
    else {
      const result = await getValidatedQuery<H3Event, { email: string, verificationCode: string }>(event, validateQuery)
      email = this.normalizeEmail(result.email)
      verificationCode = result.verificationCode
    }

    const db = useDatabaseWithMetadata()
    const dbVerification = (await db
      .prepare('SELECT * FROM emailVerifications WHERE email = ? AND verificationCode = ? LIMIT 1')
      .bind(email, verificationCode)
      .get()) as DbEmailVerification | undefined

    if (!dbVerification) {
      throw new InvalidVerificationCodeError()
    }

    if (this.hasExpired(dbVerification, 'verification')) {
      await this.deleteVerification(email, { verificationCode })
      throw new ExpiredCodeError()
    }

    const emailAuthorizationCode = generateRandomString()
    const authorizationCodeExpiration = Date.now() + 5 * 60 * 1000

    const updateResult = await db
      .prepare('UPDATE emailVerifications SET authorizationCode = ?, authorizationCodeExpiration = ?, verificationCode = NULL, verificationCodeExpiration = NULL WHERE email = ? AND verificationCode = ?')
      .bind(emailAuthorizationCode, authorizationCodeExpiration, email, verificationCode)
      .run()

    if (!hasExactlyOneChange(updateResult)) {
      throw new TokenCreationFailedError()
    }

    return this.getCallbackRedirectUrl(emailAuthorizationCode, { email })
  }

  protected override async validateLogin(event: AppEvent) {
    const validateBody = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if (!('authorizationCode' in query) || typeof query.authorizationCode !== 'string') {
        return false
      }
      return true
    }

    const { authorizationCode } = await readValidatedBody<H3Event, { authorizationCode: string }>(event, validateBody)

    const db = useDatabaseWithMetadata()
    const dbVerification = (await db
      .prepare('SELECT * FROM emailVerifications WHERE authorizationCode = ? LIMIT 1')
      .bind(authorizationCode)
      .get()) as DbEmailVerification | undefined

    if (!dbVerification) {
      throw new InvalidAuthorizationCodeError()
    }

    if (this.hasExpired(dbVerification, 'authorization')) {
      await this.deleteVerification(dbVerification.email, { authorizationCode })
      throw new ExpiredCodeError()
    }

    await this.deleteVerification(dbVerification.email, { authorizationCode })
    return dbVerification.email
  }

  private hasExpired(verification: DbEmailVerification, code?: 'verification' | 'authorization') {
    const hasVerificationExpired = verification.verificationCodeExpiration !== null && verification.verificationCodeExpiration < Date.now()
    const hasAuthorizationExpired = verification.authorizationCodeExpiration !== null && verification.authorizationCodeExpiration < Date.now()

    if (!code) {
      return hasVerificationExpired || hasAuthorizationExpired
    }

    return code === 'verification' ? hasVerificationExpired : hasAuthorizationExpired
  }

  private async deleteVerification(
    email: string,
    options: { verificationCode?: string, userId?: string, authorizationCode?: string, cancelCode?: string } = {},
  ) {
    const db = useDatabaseWithMetadata()

    const fields: string[] = ['email']
    const values: (string | null)[] = [email]

    if (options.verificationCode) {
      fields.push('verificationCode')
      values.push(options.verificationCode)
    }
    if (options.authorizationCode) {
      fields.push('authorizationCode')
      values.push(options.authorizationCode)
    }
    if (options.userId) {
      fields.push('userId')
      values.push(options.userId)
    }
    if (options.cancelCode) {
      fields.push('cancelCode')
      values.push(options.cancelCode)
    }

    const deleteResult = await db
      .prepare(`DELETE FROM emailVerifications WHERE ${fields.map(field => `${field} = ?`).join(' AND ')}`)
      .bind(...values)
      .run()

    if (!hasExactlyOneChange(deleteResult)) {
      throw new DeleteVerificationFailedError()
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }
}

interface DbEmailVerification {
  email: string
  userId: string | null
  verificationCode: string | null
  verificationCodeExpiration: number | null
  authorizationCode: string | null
  authorizationCodeExpiration: number | null
  cancelCode: string
}

class InvalidVerificationCodeError extends AppError {
  constructor() {
    super('Invalid verification code.', InvalidVerificationCodeError, 400)
  }
}

class UserHasPendingVerificationError extends AppError {
  constructor() {
    super('You already have a pending verification email. Please cancel it first.', UserHasPendingVerificationError, 400)
  }
}

class UserNotFoundByIdError extends AppError {
  constructor() {
    super(`No user found matching the given identifier.`, UserNotFoundByIdError, 404)
  }
}

class ExpiredCodeError extends AppError {
  constructor() {
    super('Your code has expired. Please try again.', ExpiredCodeError, 400)
  }
}

class TokenCreationFailedError extends AppError {
  constructor() {
    super('Failed to create token.', TokenCreationFailedError)
  }
}

class DeleteVerificationFailedError extends AppError {
  constructor() {
    super('Failed to delete existing verification.', DeleteVerificationFailedError)
  }
}

class VerificationCreationFailedError extends AppError {
  constructor() {
    super('Failed to create verification.', VerificationCreationFailedError)
  }
}
