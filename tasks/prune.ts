import { Session, TotpBucket } from '~/app'
import { defineTask } from 'nitro/task'

export default defineTask({
  meta: {
    name: 'prune',
    description: 'Prune accounts, sessions, and TOTPs.',
  },
  async run() {
    await TotpBucket.pruneInactiveAccounts()
    await Session.pruneExpired()
    await TotpBucket.pruneDeletedTotps()
    return SuccessObject.fromData().toResponse()
  },
})
