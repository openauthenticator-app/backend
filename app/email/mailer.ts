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
    assert(!!backendConfig.authentication.providers.email.host, 'Missing email host.')
    assert(!!backendConfig.authentication.providers.email.port, 'Missing email port.')
    assert(!!backendConfig.authentication.providers.email.username, 'Missing email username.')
    assert(!!backendConfig.authentication.providers.email.password, 'Missing email password.')
    let library = backendConfig.authentication.providers.email.library
    if (library === 'auto') {
      library = process.env.NITRO_PRESET?.startsWith('cloudflare-') ? 'worker-mailer' : 'nodemailer'
    }
    switch (library) {
      case 'nodemailer': {
        const mailer = await import('./nodemailer')
        return new mailer.NodemailerMailer(
          {
            host: backendConfig.authentication.providers.email.host,
            port: backendConfig.authentication.providers.email.port,
            secure: backendConfig.authentication.providers.email.secure ?? true,
            username: backendConfig.authentication.providers.email.username,
            password: backendConfig.authentication.providers.email.password,
          },
        )
      }
      case 'worker-mailer': {
        const mailer = await import('./workermailer')
        return new mailer.CloudflareWorkerMailer(
          {
            host: backendConfig.authentication.providers.email.host,
            port: backendConfig.authentication.providers.email.port,
            secure: backendConfig.authentication.providers.email.secure ?? true,
            username: backendConfig.authentication.providers.email.username,
            password: backendConfig.authentication.providers.email.password,
          },
        )
      }
    }
    throw new Error(`Unsupported email library : ${library}.`)
  }

  public abstract sendEmail(
    options: {
      from?: string
      to: string
      subject: string
      html?: string
      text?: string
    },
  ): Promise<void>
}
