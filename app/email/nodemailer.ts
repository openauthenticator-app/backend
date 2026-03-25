import { Mailer, type MailSendOptions } from './mailer'

export type NodemailerMailerOptions = {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from?: string
}

export class NodeMailer extends Mailer {
  private readonly host: string
  private readonly port: number
  private readonly secure: boolean
  private readonly username: string
  private readonly password: string
  private readonly from?: string

  constructor(options: NodemailerMailerOptions) {
    super()
    this.host = options.host
    this.port = options.port
    this.secure = options.secure
    this.username = options.username
    this.password = options.password
    this.from = options.from
  }

  public async sendEmail(options: MailSendOptions): Promise<void> {
    const nodemailer = await import('nodemailer')
    const mailer = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.username,
        pass: this.password,
      },
    })
    await mailer.sendMail({
      from: this.from ?? this.username,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
    mailer.close()
  }
}
