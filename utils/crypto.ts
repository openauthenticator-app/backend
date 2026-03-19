import crypto from 'node:crypto'

export const generateRandomString = (length: number = 24): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    const j = bytes[i]! % alphabet.length
    result = result + alphabet[j]
  }
  return result
}

export const sha256 = (input: string, pepper: string = ''): string => {
  return crypto.createHash('sha256').update(input + pepper).digest('hex')
}
