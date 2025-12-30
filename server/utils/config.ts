import defaultConfig, { BackendConfig } from '~/app/config'
import { merge } from 'smob'

export function defineBackendConfig(config: Partial<BackendConfig>): BackendConfig {
  return merge(config, defaultConfig)
}
