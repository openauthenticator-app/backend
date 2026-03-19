import { definePlugin } from 'nitro'
import {
  type BaseTransportOptions,
  captureException,
  createStackParser,
  createTransport,
  dedupeIntegration,
  eventFiltersIntegration,
  functionToStringIntegration,
  getCurrentScope,
  getIntegrationsToSetup,
  getIsolationScope,
  initAndBind,
  linkedErrorsIntegration,
  nodeStackLineParser,
  ServerRuntimeClient,
  type Transport,
  type TransportMakeRequestResponse,
} from '@sentry/core'

const stackParser = createStackParser(nodeStackLineParser())

function makeFetchTransport(options: BaseTransportOptions): Transport {
  return createTransport(options, async (request): Promise<TransportMakeRequestResponse> => {
    try {
      const response = await fetch(
        options.url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: request.body as BodyInit,
        },
      )

      await response.text()
      return {
        statusCode: response.status,
        headers: {
          'retry-after': response.headers.get('Retry-After') ?? '',
          'x-sentry-rate-limits': response.headers.get('X-Sentry-Rate-Limits') ?? '',
        },
      }
    }
    catch {
      return {
        statusCode: 0,
        headers: {
          'retry-after': '',
          'x-sentry-rate-limits': '',
        },
      }
    }
  })
}

export default definePlugin((nitroApp) => {
  const dsn = backendConfig.sentryDsn
  if (!dsn) {
    return
  }

  initAndBind(ServerRuntimeClient, {
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 1.0,
    integrations: getIntegrationsToSetup({
      defaultIntegrations: [
        dedupeIntegration(),
        eventFiltersIntegration(),
        functionToStringIntegration(),
        linkedErrorsIntegration(),
      ],
    }),
    stackParser,
    transport: makeFetchTransport,
  })

  nitroApp.hooks.hook('error', async (error, { event }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusCode = (error as any)?.statusCode ?? (error as any)?.status ?? 500
    if (statusCode < 500) {
      return
    }

    try {
      if (event?.req) {
        getIsolationScope().setContext('request', {
          method: event.req.method,
          url: event.req.url,
          headers: event.req.headers,
        })
      }

      captureException(error)

      await getCurrentScope().getClient()?.flush(2_000)
    }
    catch (captureError) {
      console.error('Failed to send error to Sentry :', captureError)
    }
  })

  nitroApp.hooks.hook('close', async () => {
    await getCurrentScope().getClient()?.flush(5_000)
  })
})
