import type { StringValue } from 'ms'
import { CookieSerializeOptions } from 'cookie-es'

export interface BackendConfig {
  url: string
  enableRegistrations: boolean
  totpLimit: {
    default: number
    contributor: number
  }
  ttl: {
    access: StringValue | number
    refresh: StringValue | number
  }
  cookies: CookieSerializeOptions
  jwtSecrets: {
    access: string
    refresh: string
    refreshPepper: string
  }
  revenueCat: {
    authorizationHeader?: string
  }
  authProviders: {
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

export default {
  url: process.env.URL as string,
  enableRegistrations: true, // TODO
  totpLimit: {
    default: 6,
    contributor: 100,
  },
  ttl: {
    access: '15m',
    refresh: '180d',
  },
  cookies: {
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
  revenueCat: {
    authorizationHeader: process.env.REVENUECAT_AUTHORIZATION_HEADER,
  },
  authProviders: {
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
      from: process.env.EMAIL_USERNAME!.toString().includes('@') ? process.env.EMAIL_USERNAME : `noreply@${new URL(process.env.URL as string).hostname}`,
    },
  },
} satisfies BackendConfig
