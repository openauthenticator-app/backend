import { H3Event } from 'h3'
import { User } from '~/app/user'

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
