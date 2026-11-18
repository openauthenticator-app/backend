import defaultConfig, { type BackendConfig } from '../app/config'
import type { DatabaseConnectionConfig, KVMount } from 'nitro/types'
import { merge } from 'smob'

// Storage mounts are a large union of driver options : they are kept as is, instead of being made partial recursively.
type NestedPartial<T> = [T] extends [KVMount] ? T : {
  [P in keyof T]?: NestedPartial<T[P]>;
}

export function defineBackendConfig(config: NestedPartial<BackendConfig>): BackendConfig {
  // Storages and databases are replaced as a whole. Merging their options with the default ones would mix the options
  // of different drivers (eg. the default `fs` storage `base` would prefix all the keys of a Cloudflare R2 storage).
  // They are copied before merging, because the merge also alters the given config.
  const totpsStorage = config.totps?.storage && { ...config.totps.storage }
  const rateLimiterStorage = config.rateLimiter?.storage && { ...config.rateLimiter.storage }
  const database = config.authentication?.database && structuredClone(config.authentication.database) as DatabaseConnectionConfig
  const result: BackendConfig = merge(config, defaultConfig)
  if (totpsStorage) {
    result.totps.storage = totpsStorage
  }
  if (rateLimiterStorage) {
    result.rateLimiter.storage = rateLimiterStorage
  }
  if (database) {
    result.authentication.database = database
  }
  return result
}
