import defaultConfig, { type BackendConfig } from '../app/config'
import type { KVMount } from 'nitro/types'
import { merge } from 'smob'

// Storage mounts are a large union of driver options : they are kept as is, instead of being made partial recursively.
type NestedPartial<T> = [T] extends [KVMount] ? T : {
  [P in keyof T]?: NestedPartial<T[P]>;
}

export function defineBackendConfig(config: NestedPartial<BackendConfig>): BackendConfig {
  return merge(config, defaultConfig)
}
