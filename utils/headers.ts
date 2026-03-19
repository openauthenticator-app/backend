import { AppError } from '~/app'
import type { H3Event } from 'nitro/h3'
import semver from 'semver'

export const requireAppVersionHeader = (
  event: H3Event,
  options: {
    addToContext?: boolean
    validate?: boolean
  } = {
    addToContext: true,
    validate: true,
  },
) => {
  const appVersion = event.req.headers.get('App-Version')
  if (!appVersion) {
    throw new MissingHeaderError('App-Version')
  }
  if (options.validate) {
    const message = validateAppVersion(appVersion)
    if (message) {
      throw new InvalidAppVersionError(message)
    }
  }
  if (options.addToContext) {
    event.context.appVersion = appVersion
  }
  return appVersion
}

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

export const requireAppClientId = (
  event: H3Event,
  options: {
    addToContext?: boolean
  } = {
    addToContext: true,
  },
) => {
  const appClientId = event.req.headers.get('App-Client-Id')
  if (!appClientId) {
    throw new MissingHeaderError('App-Client-Id')
  }
  if (options.addToContext) {
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
