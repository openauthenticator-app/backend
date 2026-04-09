import { Mailer } from './mailer'
import type { NodemailerMailerOptions } from './nodemailer'

export type WorkerMailerOptions = NodemailerMailerOptions

export class WorkerMailer extends Mailer {
  private readonly options: WorkerMailerOptions

  constructor(options: WorkerMailerOptions) {
    super()
    this.options = options
  }

  public async sendVerificationCode(email: string, verificationCode: string, magicLink: string): Promise<void> {
    const { WorkerMailer } = await import('worker-mailer')
    await WorkerMailer.send({
      credentials: {
        username: this.options.username,
        password: this.options.password,
      },
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      authType: ['login', 'plain'],
    }, {
      from: this.options.from ?? this.options.username,
      to: email,
      subject: this.options.getSubject(email, verificationCode, magicLink),
      html: this.options.getHtml(email, verificationCode, magicLink),
      text: this.options.getText(email, verificationCode, magicLink),
    })
  }
}
