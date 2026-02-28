import defaultConfig, { BackendConfig } from '~/app/config'
import { merge } from 'smob'

type NestedPartial<T> = {
  [P in keyof T]?: NestedPartial<T[P]>;
}

export function defineBackendConfig(config: NestedPartial<BackendConfig>): BackendConfig {
  return merge(config, defaultConfig)
}
