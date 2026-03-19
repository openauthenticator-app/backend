import { AuthProvider, InvalidCodeError, type Mode, ProviderAlreadyLinkedError } from '~/app/auth/providers/provider'
import type { AppEvent } from '~/app/event'
import { AppError } from '~/app/error'
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
    const { email, cancelCode } = await readValidatedBody<H3Event, { email: string, cancelCode: string }>(event, validateBody)
    const db = useDatabase()
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
      if (!('email' in query) || typeof query.email !== 'string') {
        return false
      }
      return isValidEmail(query.email)
    }
    const { email: unnormalizedEmail, mode } = await getValidatedQuery<H3Event, { email: string, mode: Mode }>(event, validateBody)
    const email = unnormalizedEmail.toLowerCase().trim()

    let userId: string | null = null
    if (mode === 'link') {
      const user = await useUser(event)
      if (user.hasProvider(this)) {
        throw new ProviderAlreadyLinkedError()
      }
      userId = user.id
    }

    const db = useDatabase()
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

      await db
        .prepare('INSERT INTO emailVerifications (email, userId, verificationCode, verificationCodeExpiration, cancelCode) VALUES (?, ?, ?, ?, ?)')
        .bind(email, userId, verificationCode, verificationCodeExpiration, cancelCode)
        .run()

      await this.sendEmail(email, verificationCode)
    }
    return url
  }

  private async sendEmail(email: string, verificationCode: string) {
    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.createTransport({
      host: backendConfig.authentication.providers.email.host,
      port: backendConfig.authentication.providers.email.port,
      secure: backendConfig.authentication.providers.email.secure,
      auth: {
        user: backendConfig.authentication.providers.email.username,
        pass: backendConfig.authentication.providers.email.password,
      },
    })

    const magicLink: URL = new URL('/auth/provider/email/callback', backendConfig.url)
    magicLink.searchParams.append('code', verificationCode)
    magicLink.searchParams.append('email', email)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Sending email to ${email} with verification code ${verificationCode}...`)
    }
    else {
      await transporter.sendMail({
        from: backendConfig.authentication.providers.email.from,
        to: email,
        subject: 'Login to Open Authenticator',
        html: `
          <p>
            Hello,
          </p>
          <p>
            We have received a login request to Open Authenticator. To proceed, you can either enter the code
            <strong>${verificationCode}</strong> in the application or click the link below :
          </p>
          <p>
            &gt; <a href="${magicLink}">${magicLink}</a>
          </p>
          <p>
            If you haven't asked to log in, you can safely ignore this email.
          </p>
        `,
      })
    }
  }

  public override async callback(event: AppEvent) {
    const validateQuery = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if (!('code' in query) || typeof query.code !== 'string') {
        return false
      }
      if (!('email' in query) || typeof query.email !== 'string') {
        return false
      }
      return isValidEmail(query.email)
    }
    let email, code
    if (event.method === 'POST') {
      const result = await readValidatedBody<H3Event, { email: string, code: string }>(event, validateQuery)
      email = result.email
      code = result.code
    }
    else {
      const result = await getValidatedQuery<H3Event, { email: string, code: string }>(event, validateQuery)
      email = result.email
      code = result.code
    }

    const db = useDatabase()
    const dbVerification = (await db
      .prepare('SELECT * FROM emailVerifications WHERE email = ? AND verificationCode = ? LIMIT 1')
      .bind(email, code)
      .get()) as DbEmailVerification | undefined

    if (!dbVerification) {
      throw new InvalidCodeError()
    }

    if (this.hasExpired(dbVerification)) {
      await this.deleteVerification(email, { verificationCode: code })
      throw new ExpiredCodeError()
    }

    const emailAuthorizationCode = generateRandomString()
    const authorizationCodeExpiration = Date.now() + 5 * 60 * 1000
    const { success } = await db
      .prepare('UPDATE emailVerifications SET authorizationCode = ?, verificationCode = NULL, authorizationCodeExpiration = ? WHERE email = ? AND verificationCode = ?')
      .bind(emailAuthorizationCode, authorizationCodeExpiration, email, code)
      .run()

    if (!success) {
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
    const db = useDatabase()
    const dbVerification = (await db
      .prepare('SELECT * FROM emailVerifications WHERE authorizationCode = ? LIMIT 1')
      .bind(authorizationCode)
      .get()) as DbEmailVerification | undefined
    if (!dbVerification) {
      throw new InvalidCodeError()
    }

    if (this.hasExpired(dbVerification)) {
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

  private async deleteVerification(email: string, options: { verificationCode?: string, userId?: string, authorizationCode?: string, cancelCode?: string } = {}) {
    const db = useDatabase()
    const fields = ['email']
    const values = [email]
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
    const { success } = await db
      .prepare(`DELETE FROM emailVerifications WHERE ${fields.join(' = ? AND ')} = ?`)
      .bind(...values)
      .run()
    if (!success) {
      throw new DeleteVerificationFailedError()
    }
  }
}

interface DbEmailVerification {
  email: string
  verificationCode: string | null
  verificationCodeExpiration: number | null
  authorizationCode: string | null
  authorizationCodeExpiration: number | null
  cancelCode: string
}

class UserHasPendingVerificationError extends AppError {
  constructor() {
    super('You already have a pending verification email. Please cancel it first.', UserHasPendingVerificationError, 400)
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
