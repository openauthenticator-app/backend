export type MailerConstructorArguments = {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
}

export abstract class Mailer {
  protected readonly host: string
  protected readonly port: number
  protected readonly secure: boolean
  protected readonly username: string
  protected readonly password: string

  protected constructor(options: MailerConstructorArguments) {
    this.host = options.host
    this.port = options.port
    this.secure = options.secure
    this.username = options.username
    this.password = options.password
  }

  public static async getBackendConfigMailer(): Promise<Mailer> {
    let library = backendConfig.email.library
    if (library === 'auto') {
      library = process.env.NITRO_PRESET?.startsWith('cloudflare-') ? 'worker-mailer' : 'nodemailer'
    }
    switch (library) {
      case 'nodemailer': {
        const mailer = await import('./nodemailer')
        return new mailer.NodemailerMailer(
          {
            host: backendConfig.email.host,
            port: backendConfig.email.port,
            secure: backendConfig.email.secure,
            username: backendConfig.email.username,
            password: backendConfig.email.password,
          },
        )
      }
      case 'worker-mailer': {
        const mailer = await import('./workermailer')
        return new mailer.CloudflareWorkerMailer(
          {
            host: backendConfig.email.host,
            port: backendConfig.email.port,
            secure: backendConfig.email.secure,
            username: backendConfig.email.username,
            password: backendConfig.email.password,
          },
        )
      }
    }
    throw new Error(`Unsupported email library : ${library}.`)
  }

  public abstract sendMail(
    options: {
      from?: string
      to: string
      subject: string
      html?: string
      text?: string
    },
  ): Promise<void>
}
