import assert from 'node:assert/strict'
import test from 'node:test'
import { exportPKCS8, generateKeyPair, jwtVerify } from 'jose'
import {
  createAppleClientSecret,
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  generateOAuthSecret,
} from '../app/auth/oauth.ts'

test('OAuth state and PKCE verifier use 32 random bytes', () => {
  const first = generateOAuthSecret()
  const second = generateOAuthSecret()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
})

test('authorization URL uses the RFC 7636 S256 challenge', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  const url = await createAuthorizationUrl(
    'https://accounts.example/authorize',
    'client-id',
    'https://backend.example/callback',
    'state-value',
    ['openid', 'profile'],
    verifier,
  )

  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'client-id')
  assert.equal(url.searchParams.get('redirect_uri'), 'https://backend.example/callback')
  assert.equal(url.searchParams.get('state'), 'state-value')
  assert.equal(url.searchParams.get('scope'), 'openid profile')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('code_challenge'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
})

test('token exchange sends the code, redirect URI, verifier, and client authentication', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, 'https://accounts.example/token')
      assert.equal(init?.method, 'POST')
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('Accept'), 'application/json')
      assert.equal(headers.get('Authorization'), 'Basic Y2xpZW50LWlkOnNlY3JldA==')
      const body = new URLSearchParams(init?.body as string)
      assert.equal(body.get('grant_type'), 'authorization_code')
      assert.equal(body.get('code'), 'authorization-code')
      assert.equal(body.get('redirect_uri'), 'https://backend.example/callback')
      assert.equal(body.get('code_verifier'), 'verifier')
      assert.equal(body.has('client_secret'), false)
      return Response.json({ access_token: 'access-token', id_token: 'id-token' })
    }

    assert.deepEqual(await exchangeAuthorizationCode({
      endpoint: 'https://accounts.example/token',
      code: 'authorization-code',
      redirectUri: 'https://backend.example/callback',
      clientId: 'client-id',
      clientSecret: 'secret',
      codeVerifier: 'verifier',
    }), { accessToken: 'access-token', idToken: 'id-token' })
  }
  finally {
    globalThis.fetch = originalFetch
  }
})

test('Apple client secret is an ES256 JWT with the required claims', async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
  const pem = await exportPKCS8(privateKey)
  const secret = await createAppleClientSecret(pem.replaceAll('\n', '\\n'), 'TEAM123456', 'KEY1234567', 'app.example')
  const { payload, protectedHeader } = await jwtVerify(secret, publicKey, {
    issuer: 'TEAM123456',
    audience: 'https://appleid.apple.com',
    subject: 'app.example',
    algorithms: ['ES256'],
  })
  assert.equal(protectedHeader.kid, 'KEY1234567')
  assert.ok(payload.iat)
  assert.ok(payload.exp && payload.exp - payload.iat! <= 300)
})

test('token exchange rejects OAuth errors even when the server replies 200', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ error: 'bad_verification_code' })
    await assert.rejects(exchangeAuthorizationCode({
      endpoint: 'https://accounts.example/token',
      code: 'invalid',
      redirectUri: 'https://backend.example/callback',
      clientId: 'client-id',
      clientSecret: 'secret',
    }), /OAuth token exchange failed/)
  }
  finally {
    globalThis.fetch = originalFetch
  }
})
