import { AuthProvider, InvalidCodeError, type Mode, ProviderAlreadyLinkedError } from '~/app/auth/providers/provider'
import crypto from 'node:crypto'
import { AppError, AppProviderEvent, ProviderEvent } from '~/app'

export class EmailProvider extends AuthProvider {
  constructor() {
    super('email')
  }

  public override async redirect(event: AppProviderEvent): ReturnType<typeof sendRedirect> {
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
    const { email: unnormalizedEmail, mode } = await getValidatedQuery<{ email: string, mode: Mode }>(event, validateBody)
    const email = unnormalizedEmail.toLowerCase().trim()

    if (mode === 'link') {
      const user = await useUser(event)
      if (user.hasProvider(this)) {
        throw new ProviderAlreadyLinkedError()
      }
    }

    const db = useDatabase()
    const existingVerification = await db
      .prepare('SELECT * FROM emailVerifications WHERE email = ? LIMIT 1')
      .bind(email)
      .get()

    const url: URL = new URL(`/auth/provider/email/sent`)
    url.protocol = 'openauthenticator:'

    let sendVerificationMail = !existingVerification
    if (existingVerification) {
      url.searchParams.append('existingVerification', 'true')

      if (typeof existingVerification !== 'object' || !('verificationCodeExpiration' in existingVerification) || typeof existingVerification.verificationCodeExpiration !== 'number') {
        await this.deleteVerification(email)
        sendVerificationMail = true
      }
      else {
        const expiration = new Date(existingVerification.verificationCodeExpiration as number)
        if (expiration < new Date()) {
          await this.deleteVerification(email)
          sendVerificationMail = true
        }
      }
    }
    if (sendVerificationMail) {
      const alphabet = '0123456789ABCDEFGHIJLMNOPQRSTUVWXYZ'
      let verificationCode = ''
      for (let i = 0; i < 6; i++) {
        verificationCode += alphabet[crypto.randomInt(alphabet.length)]
      }
      const verificationCodeExpiration = Date.now() + 10 * 60 * 1000

      await db
        .prepare('INSERT INTO emailVerifications (email, verificationCode, verificationCodeExpiration) VALUES (?, ?, ?)')
        .bind(email, verificationCode, verificationCodeExpiration)
        .run()

      await this.sendEmail(email, verificationCode)
    }
    return sendRedirect(event, url.toString())
  }

  private async sendEmail(email: string, verificationCode: string) {
    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.createTransport({
      host: backendConfig.authProviders.email.host,
      port: backendConfig.authProviders.email.port,
      secure: backendConfig.authProviders.email.secure,
      auth: {
        user: backendConfig.authProviders.email.username,
        pass: backendConfig.authProviders.email.password,
      },
    })

    const magicLink: URL = new URL('/auth/provider/email/callback', backendConfig.url)
    magicLink.searchParams.append('code', verificationCode)
    magicLink.searchParams.append('email', email)
    await transporter.sendMail({
      from: backendConfig.authProviders.email.from,
      to: email,
      subject: 'Login to Open Authenticator',
      html: `
        <h1>Login to Open Authenticator</h1>
        <p>
          Hello,
        </p>
        <p>
          We have received a login request to Open Authenticator. To proceed, you can either enter the code
          <strong>${verificationCode}</strong> in the login page or click the link below :
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

  private deleteVerification(email: string, options: { verificationCode?: string, authorizationCode?: string } = {}) {
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
    return db
      .prepare(`DELETE FROM emailVerifications WHERE ${fields.join(' = ? AND ')} = ?`)
      .bind(...values)
      .run()
  }

  public override async callback(event: ProviderEvent): Promise<void> {
    const validateBody = (query: unknown): boolean => {
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
    const { email, code } = await getValidatedQuery<{ email: string, code: string }>(event, validateBody)

    const db = useDatabase()
    const verification = await db
      .prepare('SELECT * FROM emailVerifications WHERE email = ? AND verificationCode = ? LIMIT 1')
      .bind(email, code)
      .get()

    if (!verification) {
      throw new InvalidCodeError()
    }

    if (typeof verification !== 'object' || !('verificationCodeExpiration' in verification) || typeof verification.verificationCodeExpiration !== 'number') {
      await this.deleteVerification(email, { verificationCode: code })
      throw new InvalidCodeError()
    }

    const verificationCodeExpiration = new Date(verification.verificationCodeExpiration as number)
    if (verificationCodeExpiration < new Date()) {
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

    return await this.redirectIntoApp(event, emailAuthorizationCode, { email })
  }

  protected override async validateLogin(event: AppProviderEvent) {
    const validateBody = (query: unknown): boolean => {
      if (!query || typeof query !== 'object') {
        return false
      }
      if (!('authorizationCode' in query) || typeof query.authorizationCode !== 'string') {
        return false
      }
      if (!('email' in query) || typeof query.email !== 'string') {
        return false
      }
      return isValidEmail(query.email)
    }
    const { authorizationCode, email } = await readValidatedBody<{ authorizationCode: string, email: string }>(event, validateBody)
    const db = useDatabase()
    const verification = await db
      .prepare('SELECT * FROM emailVerifications WHERE authorizationCode = ? AND email = ? LIMIT 1')
      .bind(authorizationCode, email)
      .get()
    if (!verification) {
      throw new InvalidCodeError()
    }

    if (typeof verification !== 'object' || !('authorizationCodeExpiration' in verification) || typeof verification.authorizationCodeExpiration !== 'number') {
      await this.deleteVerification(email, { authorizationCode })
      throw new InvalidCodeError()
    }

    const authorizationCodeExpiration = new Date(verification.authorizationCodeExpiration as number)
    if (authorizationCodeExpiration < new Date()) {
      await this.deleteVerification(email, { authorizationCode })
      throw new ExpiredCodeError()
    }

    await this.deleteVerification(email, { authorizationCode })
    return email
  }
}

export class ExpiredCodeError extends AppError {
  constructor() {
    super('Your code has expired. Please try again.', 400)
  }
}

export class TokenCreationFailedError extends AppError {
  constructor() {
    super('Failed to create token.')
  }
}
