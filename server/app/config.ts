import type { StringValue } from 'ms'
import type { CookieSerializeOptions } from 'cookie-es'
import type { Range } from 'semver'
import type { Driver } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

export interface BackendConfig {
  url: string
  appVersionRange: string | Range
  enableRegistrations: boolean
  adminHeader?: string
  totps: {
    storage: Driver
    limit: {
      default: number
      contributor: number
    }
  }
  sentry?: {
    dsn?: string
  }
  authentication: {
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
        host?: string
        port?: number
        secure?: boolean
        username?: string
        password?: string
        from?: string
      }
    }
  }
  revenueCat: {
    contributorPlanEntitlementId?: string
    authorizationHeader?: string
  }
}

export default {
  url: process.env.URL as string,
  appVersionRange: '>=2.0.0 <3.0.0',
  enableRegistrations: true,
  adminHeader: process.env.ADMIN_HEADER,
  totps: {
    storage: memoryDriver(),
    limit: {
      default: 6,
      contributor: 100,
    },
  },
  sentry: process.env.SENTRY_DSN ? { dsn: process.env.SENTRY_DSN } : undefined,
  authentication: {
    tokensTtl: {
      access: '15m',
      refresh: '180d',
    },
    cookiesOptions: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
        host: process.env.EMAIL_HOST,
        port: 465,
        secure: true,
        username: process.env.EMAIL_USERNAME,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_USERNAME?.toString().includes('@') ? process.env.EMAIL_USERNAME : `noreply@${new URL(process.env.URL as string).hostname}`,
      },
    },
  },
  revenueCat: {
    contributorPlanEntitlementId: 'contributor_plan',
    authorizationHeader: process.env.REVENUECAT_AUTHORIZATION_HEADER,
  },
} satisfies BackendConfig
