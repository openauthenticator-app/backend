import pkg from '~/../package.json' assert { type: 'json' }
import type { H3Event } from 'h3'

const protectedPaths = [
  {
    prefix: '/auth',
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
  let ignore = true
  const path = getRequestURL(event).pathname
  for (const { prefix, exclusionSuffixes = [] } of protectedPaths) {
    if (path.startsWith(prefix) && !exclusionSuffixes.some(suffix => path.endsWith(suffix))) {
      ignore = false
    }
  }
  if (ignore) {
    return
  }
  requireAppClientId(event)
  requireAppVersionHeader(event)
})
