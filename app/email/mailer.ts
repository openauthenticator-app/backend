import type { NodemailerMailerOptions } from './nodemailer'
import type { WorkerMailerOptions } from './workermailer'
import type { SimpleMailerFreeModeOptions, SimpleMailerTemplateModeOptions } from './simplemailer'

export type MailerLibrary = 'nodemailer' | 'workermailer' | 'simplemailer-free' | 'simplemailer-template'

export type MailerOptions = {
  'nodemailer': NodemailerMailerOptions
  'workermailer': WorkerMailerOptions
  'simplemailer-free': SimpleMailerFreeModeOptions
  'simplemailer-template': SimpleMailerTemplateModeOptions
}

export interface FreeMailerOptions {
  getSubject(email: string, verificationCode: string, magicLink: string, locale?: string): string
  getHtml(email: string, verificationCode: string, magicLink: string, locale?: string): string | undefined
  getText(email: string, verificationCode: string, magicLink: string, locale?: string): string | undefined
}

export abstract class Mailer {
  public static async getBackendConfigMailer(): Promise<Mailer> {
    switch (backendConfig.authentication.providers.email.library) {
      case 'nodemailer': {
        const { NodeMailer } = await import('./nodemailer')
        return new NodeMailer(backendConfig.authentication.providers.email)
      }
      case 'workermailer': {
        const { WorkerMailer } = await import('./workermailer')
        return new WorkerMailer(backendConfig.authentication.providers.email)
      }
      case 'simplemailer-free': {
        const { SimpleMailerFreeMode } = await import('./simplemailer')
        return new SimpleMailerFreeMode(backendConfig.authentication.providers.email)
      }
      case 'simplemailer-template': {
        const { SimpleMailerTemplateMode } = await import('./simplemailer')
        return new SimpleMailerTemplateMode(backendConfig.authentication.providers.email)
      }
    }
  }

  public abstract sendVerificationCode(email: string, verificationCode: string, magicLink: string, locale?: string): Promise<void>
}
