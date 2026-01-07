import pkg from '~/../package.json' assert { type: 'json' }
import { AppError } from '~/app'
import type { H3Event } from 'h3'
import semver from 'semver'

function validateAppVersion(appVersion: string): string | null {
  const parts = appVersion.match(/^[0-9]+\.[0-9]+\.[0-9]+$/)
  if (!parts) {
    return 'invalid version provided'
  }
  if (!semver.satisfies(appVersion, backendConfig.appVersionRange)) {
    return `unsupported version provided, must satisfy ${backendConfig.appVersionRange}`
  }
  return null
}

const protectedPaths = [
  {
    prefix: '/auth/provider/',
    exclusionSuffixes: ['/redirect', '/callback'],
  },
  {
    prefix: '/totps',
  },
  {
    prefix: '/user',
  },
]

export default defineEventHandler(async (event: H3Event) => {
  setResponseHeader(event, 'Backend-Version', pkg.version)
  setResponseHeader(event, 'Backend-App-Version-Range', '>=2.0.0 <3.0.0')
  const path = getRequestURL(event).pathname
  for (const { prefix, exclusionSuffixes = [] } of protectedPaths) {
    if (!path.startsWith(prefix) || exclusionSuffixes.some(string => path.endsWith(string))) {
      return
    }
  }
  const appVersion = getHeader(event, 'App-Version')
  if (!appVersion) {
    throw new MissingHeaderError('App-Version')
  }
  const message = validateAppVersion(appVersion)
  if (message) {
    throw new InvalidAppVersionError(message)
  }
  const appClientId = getHeader(event, 'App-Client-Id')
  if (!appClientId) {
    throw new MissingHeaderError('App-Client-Id')
  }
  event.context.appVersion = appVersion
  event.context.appClientId = appClientId
})

class MissingHeaderError extends AppError {
  constructor(header: string) {
    super(`Missing an header : ${header}.`, MissingHeaderError, 404)
  }
}

class InvalidAppVersionError extends AppError {
  constructor(message: string) {
    super(`Invalid app version : ${message}.`, InvalidAppVersionError, 404)
  }
}
