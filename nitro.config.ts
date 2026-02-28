import { defineNitroConfig } from 'nitropack/config'
import backendConfig from './backend.config'
import fsDriver from 'unstorage/drivers/fs'

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
    totps: process.env.NODE_ENV === 'production'
      ? backendConfig.totps.storage
      : fsDriver({
          base: './.data/storage',
        }),
  },
  database: {
    default: process.env.NODE_ENV === 'production'
      ? backendConfig.authentication.database
      : {
          connector: 'sqlite',
          options: {
            name: 'db',
          },
        },
  },
})
