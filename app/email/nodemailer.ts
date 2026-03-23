import nodemailer from 'nodemailer'
import { Mailer, type MailerConstructorArguments } from './mailer'

export class NodemailerMailer extends Mailer {
  constructor(options: MailerConstructorArguments) {
    super(options)
  }

  public async sendEmail(
    options: {
      from?: string
      to: string
      subject: string
      html?: string
      text?: string
    },
  ): Promise<void> {
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
      from: options.from ?? this.username,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
    mailer.close()
  }
}
