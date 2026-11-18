import backendConfig from '~/backend.config'
import { AppError } from '~/app/error'
import type { H3Event } from 'nitro/h3'
import semver from 'semver'

export const requireAppVersionHeader = (
  event: H3Event,
  { addToContext = true, validate = true }: {
    addToContext?: boolean
    validate?: boolean
  } = {},
) => {
  const appVersion = event.req.headers.get('App-Version')
  if (!appVersion) {
    throw new MissingHeaderError('App-Version')
  }
  if (validate) {
    const message = validateAppVersion(appVersion)
    if (message) {
      throw new InvalidAppVersionError(message)
    }
  }
  if (addToContext) {
    event.context.appVersion = appVersion
  }
  return appVersion
}

function validateAppVersion(appVersion: string): string | null {
  if (appVersion.endsWith('-dev')) {
    appVersion = appVersion.substring(0, appVersion.length - '-dev'.length)
  }
  const parts = appVersion.match(/^[0-9]+\.[0-9]+\.[0-9]+$/)
  if (!parts) {
    return 'invalid version provided'
  }
  if (!semver.satisfies(appVersion, backendConfig.appVersionRange, { includePrerelease: false })) {
    return `unsupported version provided, must satisfy ${backendConfig.appVersionRange}`
  }
  return null
}

export const requireAppClientId = (
  event: H3Event,
  { addToContext = true }: {
    addToContext?: boolean
  } = {},
) => {
  const appClientId = event.req.headers.get('App-Client-Id')
  if (!appClientId) {
    throw new MissingHeaderError('App-Client-Id')
  }
  if (addToContext) {
    event.context.appClientId = appClientId
  }
  return appClientId
}

class MissingHeaderError extends AppError {
  constructor(header: string) {
    super(`Missing an header : ${header}.`, MissingHeaderError, 400)
  }
}

class InvalidAppVersionError extends AppError {
  constructor(message: string) {
    super(`Invalid app version : ${message}.`, InvalidAppVersionError, 400)
  }
}
