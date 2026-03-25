import { NodeMailer, type NodemailerMailerOptions } from './nodemailer'
import { WorkerMailer, type WorkerMailerOptions } from './workermailer'
import { SimpleMailer, type SimpleMailerOptions } from './simplemailer'

export type MailerLibrary = 'nodemailer' | 'workermailer' | 'simplemailer'

export type MailerOptions = {
  nodemailer: NodemailerMailerOptions
  workermailer: WorkerMailerOptions
  simplemailer: SimpleMailerOptions
}

export type MailSendOptions = {
  to: string
  subject: string
  html?: string
  text?: string
}

export abstract class Mailer {
  public static async getBackendConfigMailer(): Promise<Mailer> {
    switch (backendConfig.authentication.providers.email.library) {
      case 'nodemailer': {
        return new NodeMailer(
          {
            host: backendConfig.authentication.providers.email.host,
            port: backendConfig.authentication.providers.email.port,
            secure: backendConfig.authentication.providers.email.secure ?? true,
            username: backendConfig.authentication.providers.email.username,
            password: backendConfig.authentication.providers.email.password,
          },
        )
      }
      case 'workermailer': {
        return new WorkerMailer(
          {
            host: backendConfig.authentication.providers.email.host,
            port: backendConfig.authentication.providers.email.port,
            secure: backendConfig.authentication.providers.email.secure ?? true,
            username: backendConfig.authentication.providers.email.username,
            password: backendConfig.authentication.providers.email.password,
          },
        )
      }
      case 'simplemailer': {
        return new SimpleMailer(
          {
            url: backendConfig.authentication.providers.email.url,
            apiKey: backendConfig.authentication.providers.email.apiKey,
          },
        )
      }
    }
  }

  public abstract sendEmail(options: MailSendOptions): Promise<void>
}
