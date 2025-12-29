import crypto from 'node:crypto'

export const generateRandomString = (length: number = 24): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  // Generate 24 bytes = 192 bits of entropy.
  // We're only going to use 5 bits per byte so the total entropy will be 192 * 5 / 8 = 120 bits
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let id = ''
  for (let i = 0; i < bytes.length; i++) {
    // >> 3 "removes" the right-most 3 bits of the byte
    id += alphabet[bytes[i] >> 3]
  }
  return id
}

export const sha256 = (input: string, pepper: string = ''): string => {
  return crypto.createHash('sha256').update(input + pepper).digest('hex')
}
