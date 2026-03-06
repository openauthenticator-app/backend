import { NitroApp } from 'nitropack'
import * as Sentry from '@sentry/nuxt'
import { sentryCloudflareNitroPlugin } from '@sentry/nuxt/module/plugins'
import { H3Error } from 'h3'

export default defineNitroPlugin(sentryCloudflareNitroPlugin((nitroApp: NitroApp) => {
  const dsn = backendConfig.sentryDsn

  if (!dsn) {
    return {}
  }

  nitroApp.hooks.hook('error', (error) => {
    if (error instanceof H3Error && [400, 401, 404].includes(error.statusCode)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      return
    }

    Sentry.captureException(error)
  })
  return {
    dsn,
    tracesSampleRate: 1.0,
  }
}))
