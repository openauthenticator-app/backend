import { Mailer, type MailSendOptions } from './mailer'
import type { NodemailerMailerOptions } from './nodemailer'

export type WorkerMailerOptions = NodemailerMailerOptions

export class WorkerMailer extends Mailer {
  private readonly host: string
  private readonly port: number
  private readonly secure: boolean
  private readonly username: string
  private readonly password: string
  private readonly from?: string

  constructor(options: WorkerMailerOptions) {
    super()
    this.host = options.host
    this.port = options.port
    this.secure = options.secure
    this.username = options.username
    this.password = options.password
    this.from = options.from
  }

  public async sendEmail(options: MailSendOptions): Promise<void> {
    const { WorkerMailer } = await import('worker-mailer')
    await WorkerMailer.send({
      credentials: {
        username: this.username,
        password: this.password,
      },
      host: this.host,
      port: this.port,
      secure: this.secure,
      authType: ['login', 'plain'],
    }, {
      from: this.from ?? this.username,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  }
}
