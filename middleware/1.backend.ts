import pkg from '~/package.json' assert { type: 'json' }
import { defineHandler, getRequestURL, type H3Event } from 'nitro/h3'

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
  {
    prefix: '/ping',
  },
]

export default defineHandler(async (event: H3Event) => {
  event.res.headers.set('Backend-Version', pkg.version)
  event.res.headers.set('Backend-App-Version-Range', '>=2.0.0 <3.0.0')
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
