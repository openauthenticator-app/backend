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
  initAndBind,
  linkedErrorsIntegration,
  nodeStackLineParser,
  ServerRuntimeClient,
  type Transport,
  type TransportMakeRequestResponse,
} from '@sentry/core'

const stackParser = createStackParser(nodeStackLineParser())

function getPathname(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }

  try {
    return new URL(url).pathname
  }
  catch {
    try {
      return new URL(url, backendConfig.url).pathname
    }
    catch {
      return url.split('?')[0]
    }
  }
}

function getAuthProvider(pathname: string | undefined): string | undefined {
  return pathname?.match(/^\/auth\/provider\/([^/]+)/)?.[1]
}

function getCaptureContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  statusCode: number,
) {
  const pathname = getPathname(event?.req?.url)
  const authProvider = getAuthProvider(pathname)
  const tags: Record<string, string | number | boolean> = {
    statusCode,
  }

  if (event?.req?.method) {
    tags.method = event.req.method
  }
  if (pathname) {
    tags.path = pathname
  }
  if (authProvider) {
    tags.authProvider = authProvider
  }
  if (event?.context?.appVersion) {
    tags.appVersion = event.context.appVersion
  }
  if (event?.context?.appClientId) {
    tags.appClientId = event.context.appClientId
  }
  if (typeof event?.context?.user !== 'undefined') {
    tags.authenticated = !!event.context.user
  }

  return {
    tags,
    contexts: {
      request: {
        method: event?.req?.method,
        path: pathname,
        url: pathname,
      },
      app: {
        version: event?.context?.appVersion,
        clientId: event?.context?.appClientId,
      },
      auth: {
        provider: authProvider,
        authenticated: !!event?.context?.user,
      },
    },
    ...(event?.context?.user?.id && { user: { id: event.context.user.id } }),
  }
}

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
      captureException(error, getCaptureContext(event, statusCode))

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
