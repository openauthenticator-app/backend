import { defineNitroConfig } from 'nitropack/config'
import backendConfig from './backend.config'

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
  storage: {
    totps: backendConfig.totps.storage,
    ...(backendConfig.rateLimiter.enable && { rateLimiter: backendConfig.rateLimiter.storage }),
  },
  devStorage: {
    totps: {
      driver: 'fs',
      base: './.data/storage',
    },
    ...(backendConfig.rateLimiter.enable && { rateLimiter: { driver: 'memory' } }),
  },
  database: {
    default: backendConfig.authentication.database,
  },
  devDatabase: {
    default: {
      connector: 'sqlite',
      options: {
        name: 'db',
      },
    },
  },
})
