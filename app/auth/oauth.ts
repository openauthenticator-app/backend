import { base64url, importPKCS8, SignJWT } from 'jose'

export interface OAuthTokens {
  accessToken: string
  idToken?: string
}

interface AuthorizationCodeRequest {
  endpoint: string
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
  codeVerifier?: string
  authentication?: 'basic' | 'body'
}

export function generateOAuthSecret(): string {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(32)))
}

export async function createAuthorizationUrl(
  endpoint: string,
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[],
  codeVerifier?: string,
): Promise<URL> {
  const url = new URL(endpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  if (scopes.length > 0) {
    url.searchParams.set('scope', scopes.join(' '))
  }
  if (codeVerifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('code_challenge', base64url.encode(new Uint8Array(digest)))
  }
  return url
}

export async function exchangeAuthorizationCode({
  endpoint,
  code,
  redirectUri,
  clientId,
  clientSecret,
  codeVerifier,
  authentication = 'basic',
}: AuthorizationCodeRequest): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier)
  }
  const headers = new Headers({
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'open-authenticator-backend',
  })
  if (authentication === 'body') {
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
  }
  else {
    const credentials = new TextEncoder().encode(`${clientId}:${clientSecret}`)
    headers.set('Authorization', `Basic ${btoa(String.fromCharCode(...credentials))}`)
  }

  const response = await fetch(endpoint, { method: 'POST', headers, body })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok || !data || typeof data !== 'object' || 'error' in data || !('access_token' in data) || typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new Error('OAuth token exchange failed.')
  }
  if ('id_token' in data && typeof data.id_token !== 'string') {
    throw new Error('OAuth token response contains an invalid ID token.')
  }
  return {
    accessToken: data.access_token,
    ...('id_token' in data ? { idToken: data.id_token as string } : {}),
  }
}

export async function createAppleClientSecret(
  pem: string,
  teamId: string,
  keyId: string,
  clientId: string,
): Promise<string> {
  const privateKey = await importPKCS8(pem.replaceAll('\\n', '\n').replaceAll('\r', ''), 'ES256')
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}
