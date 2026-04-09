import { type FreeMailerOptions, Mailer } from './mailer'
import { AppError } from '~/app/error'

interface SimpleMailerOptions {
  url: string
  apiKey: string
}

export interface SimpleMailerFreeModeOptions extends FreeMailerOptions, SimpleMailerOptions {}

export interface SimpleMailerTemplateModeOptions extends SimpleMailerOptions {
  createParams(email: string, verificationCode: string, magicLink: string): unknown
}

abstract class SimpleMailer<T extends SimpleMailerOptions> extends Mailer {
  readonly options: T

  protected constructor(options: T) {
    super()
    this.options = options
  }

  public override async sendVerificationCode(email: string, verificationCode: string, magicLink: string): Promise<void> {
    const response = await fetch(
      `${this.options.url}/send.php`,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': this.options.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.createBody(email, verificationCode, magicLink)),
      },
    )
    const jsonResponse = await response.json()
    if (jsonResponse.error) {
      throw new InvalidResponseError(jsonResponse.error)
    }
  }

  abstract createBody(email: string, verificationCode: string, magicLink: string): unknown
}

export class SimpleMailerFreeMode extends SimpleMailer<SimpleMailerFreeModeOptions> {
  constructor(options: SimpleMailerFreeModeOptions) {
    super(options)
  }

  createBody(email: string, verificationCode: string, magicLink: string): unknown {
    return {
      to: email,
      subject: this.options.getSubject(email, verificationCode, magicLink),
      html: this.options.getHtml(email, verificationCode, magicLink),
      text: this.options.getText(email, verificationCode, magicLink),
    }
  }
}

export class SimpleMailerTemplateMode extends SimpleMailer<SimpleMailerTemplateModeOptions> {
  constructor(options: SimpleMailerTemplateModeOptions) {
    super(options)
  }

  createBody(email: string, verificationCode: string, magicLink: string): unknown {
    return {
      to: email,
      params: this.options.createParams(email, verificationCode, magicLink),
    }
  }
}

class InvalidResponseError extends AppError {
  constructor(error: string) {
    super(`Invalid response from SimpleMailer : ${error}.`, InvalidResponseError)
  }
}
