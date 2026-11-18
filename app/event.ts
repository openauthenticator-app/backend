import type { H3Event } from 'nitro/h3'
import type { User } from '~/app/user'

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

declare module 'h3' {
  interface H3EventContext {
    user?: User
    appVersion?: string
    appClientId?: string
  }
}
