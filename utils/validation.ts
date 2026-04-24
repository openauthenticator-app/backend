export const isEncryptedTotp = (object: unknown) => {
  if (!object || typeof object !== 'object') {
    return false
  }
  if ('algorithm' in object && (typeof object.algorithm !== 'string' || !['SHA1', 'SHA256', 'SHA512'].includes(object.algorithm))) {
    return false
  }
  if ('digits' in object && typeof object.digits !== 'number') {
    return false
  }
  if ('validity' in object && typeof object.validity !== 'number') {
    return false
  }
  if (!('updatedAt' in object) || typeof object.updatedAt !== 'number') {
    return false
  }
  if (!('encryptionSalt' in object) || !isUint8Array(object.encryptionSalt)) {
    return false
  }
  if (!('secret' in object) || !isUint8Array(object.secret)) {
    return false
  }
  if (!('label' in object) || !isUint8Array(object.label)) {
    return false
  }
  if (!('issuer' in object) || !isUint8Array(object.issuer)) {
    return false
  }
  if ('imageUrl' in object && !isUint8Array(object.imageUrl)) {
    return false
  }
  return true
}

const isUint8Array = (object: unknown) => Array.isArray(object) && object.every(item => typeof item === 'number' && item >= 0 && item <= 255)

export const isValidUUID = (uuid: string) => {
  return /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(uuid)
}

export const isValidEmail = (email: string) => {
  return !!email.match(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  )
}

export const isValidLocale = (locale: string) => {
  return /^[A-Za-z]{2,4}([_-][A-Za-z]{4})?([_-]([A-Za-z]{2}|[0-9]{3}))?$/.test(locale)
}
