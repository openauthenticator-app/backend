import type { StringValue } from 'ms'
import type { Range } from 'semver'
import type { BuiltinDriverName, BuiltinDriverOptions } from 'unstorage'
import type { DatabaseConnectionConfig } from 'nitro/types'
import type { CookieSerializeOptions } from '~/app/auth/providers/provider'
import type { MailerLibrary, MailerOptions } from '~/app/email'
import 'dotenv/config'

export interface BackendConfig {
  url: string
  appVersionRange: string | Range
  enableRegistrations: boolean
  adminHeader?: string
  totps: {
    storage: {
      // @ts-expect-error `K` is a driver name, and therefore can be used to index `BuiltinDriverOptions`.
      [K in BuiltinDriverName]: { driver: K } & BuiltinDriverOptions[K];
    }[BuiltinDriverName]
    limit: {
      default: number
      contributor: number
    }
  }
  authentication: {
    database: DatabaseConnectionConfig
    tokensTtl: {
      access: StringValue | number
      refresh: StringValue | number
    }
    cookiesOptions: CookieSerializeOptions
    jwtSecrets: {
      access: string
      refresh: string
      refreshPepper: string
    }
    providers: {
      google: {
        clientId?: string
        clientSecret?: string
      }
      apple: {
        clientId?: string
        teamId?: string
        keyId?: string
        pemCertificate?: string
      }
      github: {
        clientId?: string
        clientSecret?: string
      }
      microsoft: {
        clientId?: string
        clientSecret?: string
        tenantId?: string
      }
      email: {
        [K in MailerLibrary]: { library: K } & MailerOptions[K];
      }[MailerLibrary]
    }
  }
  sentryDsn?: string
  revenueCat: {
    contributorPlanEntitlementId?: string
    authorizationHeader?: string
  }
  rateLimiter: {
    enable: boolean
    storage: {
      // @ts-expect-error `K` is a driver name, and therefore can be used to index `BuiltinDriverOptions`.
      [K in BuiltinDriverName]: { driver: K } & BuiltinDriverOptions[K];
    }[BuiltinDriverName]
  }
}

export default {
  url: process.env.URL as string,
  appVersionRange: '>=2.0.0 <3.0.0',
  enableRegistrations: true,
  adminHeader: process.env.ADMIN_HEADER,
  totps: {
    storage: {
      driver: 'memory',
    },
    limit: {
      default: 6,
      contributor: 100,
    },
  },
  authentication: {
    database: {
      connector: 'sqlite',
      options: {
        name: 'db',
      },
    },
    tokensTtl: {
      access: '15m',
      refresh: '60d',
    },
    cookiesOptions: {
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: process.env.NODE_ENV === 'production' ? 60 * 15 : 60 * 60,
      sameSite: 'lax',
    },
    jwtSecrets: {
      access: process.env.JWT_ACCESS_SECRET!,
      refresh: process.env.JWT_REFRESH_SECRET!,
      refreshPepper: process.env.JWT_REFRESH_PEPPER!,
    },
    providers: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID,
        teamId: process.env.APPLE_TEAM_ID,
        keyId: process.env.APPLE_KEY_ID,
        pemCertificate: process.env.APPLE_PEM_CERTIFICATE,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID,
      },
      email: {
        library: 'nodemailer',
        host: process.env.EMAIL_HOST ?? 'smtp.example.com',
        port: 465,
        secure: true,
        username: process.env.EMAIL_USERNAME ?? 'username',
        password: process.env.EMAIL_PASSWORD ?? 'password',
        from: (() => {
          if (process.env.EMAIL_USERNAME?.toString().includes('@')) {
            return process.env.EMAIL_USERNAME
          }
          const url = process.env.URL
          return url ? `noreply@${new URL(url).hostname}` : undefined
        })(),
      },
    },
  },
  sentryDsn: process.env.SENTRY_DSN,
  revenueCat: {
    contributorPlanEntitlementId: 'contributor_plan',
    authorizationHeader: process.env.REVENUECAT_AUTHORIZATION_HEADER,
  },
  rateLimiter: {
    enable: true,
    storage: {
      driver: 'memory',
    },
  },
} satisfies BackendConfig
