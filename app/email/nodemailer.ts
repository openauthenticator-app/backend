import { type FreeMailerOptions, Mailer } from './mailer'

export interface NodemailerMailerOptions extends FreeMailerOptions {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from?: string
}

export class NodeMailer extends Mailer {
  private readonly options: NodemailerMailerOptions

  constructor(options: NodemailerMailerOptions) {
    super()
    this.options = options
  }

  public async sendVerificationCode(email: string, verificationCode: string, magicLink: string): Promise<void> {
    const nodemailer = await import('nodemailer')
    const mailer = nodemailer.createTransport({
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      auth: {
        user: this.options.username,
        pass: this.options.password,
      },
    })
    await mailer.sendMail({
      from: this.options.from ?? this.options.username,
      to: email,
      subject: this.options.getSubject(email, verificationCode, magicLink),
      html: this.options.getHtml(email, verificationCode, magicLink),
      text: this.options.getText(email, verificationCode, magicLink),
    })
    mailer.close()
  }
}
