import defaultConfig, { type BackendConfig } from '../app/config'
import type { DatabaseConnectionConfig, KVMount } from 'nitro/types'
import { merge } from 'smob'

// Storage mounts are a large union of driver options : they are kept as is, instead of being made partial recursively.
type NestedPartial<T> = [T] extends [KVMount] ? T : {
  [P in keyof T]?: NestedPartial<T[P]>;
}

export function defineBackendConfig(config: NestedPartial<BackendConfig>): BackendConfig {
  const result: BackendConfig = merge(config, defaultConfig)
  // Storages and databases are replaced as a whole. Merging their options with the default ones would mix the options
  // of different drivers (eg. the default `fs` storage `base` would prefix all the keys of a Cloudflare R2 storage).
  if (config.totps?.storage) {
    result.totps.storage = config.totps.storage
  }
  if (config.rateLimiter?.storage) {
    result.rateLimiter.storage = config.rateLimiter.storage
  }
  if (config.authentication?.database) {
    result.authentication.database = config.authentication.database as DatabaseConnectionConfig
  }
  return result
}
