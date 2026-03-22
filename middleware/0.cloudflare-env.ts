import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler((event: H3Event) => {
  const cloudflare = event.req.runtime?.cloudflare

  if (cloudflare?.env) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__env__ = cloudflare.env
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__cf_env__ = cloudflare.env
  }
})
