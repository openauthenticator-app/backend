import { Mailer, type MailSendOptions } from './mailer'
import { AppError } from '~/app/error'

export type SimpleMailerOptions = {
  url: string
  apiKey: string
}

export class SimpleMailer extends Mailer {
  private readonly url: string
  private readonly apiKey: string

  constructor(options: SimpleMailerOptions) {
    super()
    this.url = options.url
    this.apiKey = options.apiKey
  }

  public override async sendEmail(options: MailSendOptions): Promise<void> {
    const response = await fetch(
      this.url,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      },
    )
    const jsonResponse = await response.json()
    if (jsonResponse.error) {
      throw new InvalidResponseError(jsonResponse.error)
    }
  }
}

class InvalidResponseError extends AppError {
  constructor(error: string) {
    super(`Invalid response from SimpleMailer : ${error}.`, InvalidResponseError)
  }
}
