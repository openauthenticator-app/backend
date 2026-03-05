import { NitroApp } from 'nitropack'
import * as Sentry from '@sentry/node'
import { H3Error } from 'h3'

export default defineNitroPlugin((nitroApp: NitroApp) => {
  const dsn = backendConfig.sentry?.dsn

  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 1.0,
      profileSessionSampleRate: 1.0,
      profileLifecycle: 'trace',
    })

    nitroApp.hooks.hook('error', (error) => {
      if (error instanceof H3Error && [400, 401, 404].includes(error.statusCode)) {
        return
      }

      if (process.env.NODE_ENV !== 'production') {
        return
      }

      Sentry.captureException(error)
    })
  }
})
