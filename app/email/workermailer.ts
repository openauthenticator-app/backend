import { WorkerMailer } from 'worker-mailer'
import { Mailer, type MailerConstructorArguments } from './mailer'

export class CloudflareWorkerMailer extends Mailer {
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
      from: options.from ?? this.username,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  }
}
