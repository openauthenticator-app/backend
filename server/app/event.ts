import { H3Event } from 'h3'
import { User } from '~/app/user'
import { AuthProvider } from '~/app/auth'

export interface AppEvent extends H3Event {
  context: H3Event['context'] & {
    appVersion: string
    appClientId: string
  }
}

export interface UserEvent extends AppEvent {
  context: AppEvent['context'] & {
    user: User
  }
}

export interface ProviderEvent extends H3Event {
  context: AppEvent['context'] & {
    authProvider: AuthProvider
  }
}

export type AppProviderEvent = AppEvent & ProviderEvent
