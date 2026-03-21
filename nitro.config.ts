import { defineConfig } from 'nitro/config'
import backendConfig from './backend.config'

// https://nitro.build/config
export default defineConfig({
  compatibilityDate: 'latest',
  serverDir: './',
  cloudflare: {
    nodeCompat: true,
  },
  rolldownConfig: {
    resolve: {
      mainFields: ['module', 'main'],
    },
  },
  experimental: {
    database: true,
    tasks: true,
  },
  scheduledTasks: {
    '0 0 1 * *': 'prune',
  },
  routeRules: {
    '/': {
      prerender: true,
    },
  },
  imports: {
    dirs: ['./utils'],
    imports: [
      {
        name: 'default',
        as: 'backendConfig',
        from: '~/backend.config.ts',
      },
    ],
  },
  errorHandler: './error',
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
