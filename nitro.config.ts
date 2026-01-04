import { defineNitroConfig } from 'nitropack/config'

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: 'latest',
  srcDir: 'server',
  experimental: {
    database: true,
  },
  imports: {
    imports: [
      {
        name: 'default',
        as: 'backendConfig',
        from: '~~/backend.config.ts',
      },
    ],
  },
  sourceMap: true,
  errorHandler: '~/error',
  prerender: {
    routes: ['/'],
  },
})
