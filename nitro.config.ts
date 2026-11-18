import { defineConfig } from 'nitro/config'
import { fileURLToPath } from 'url'
import backendConfig from './backend.config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://nitro.build/config
export default defineConfig({
  compatibilityDate: 'latest',
  serverDir: './',
  alias: {
    '~': rootDir,
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
  errorHandler: './error-handler',
  prerender: {
    routes: ['/'],
  },
  kv: {
    totps: backendConfig.totps.storage,
    ...(backendConfig.rateLimiter.enable && { rateLimiter: backendConfig.rateLimiter.storage }),
  },
  $development: {
    kv: {
      totps: {
        driver: 'fs',
        base: './.data/storage',
      },
      ...(backendConfig.rateLimiter.enable && { rateLimiter: { driver: 'memory' } }),
    },
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
