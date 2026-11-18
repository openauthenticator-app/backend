import { SuccessObject } from '~/utils/response'
import { pruneAll } from '~/app'
import { defineTask } from 'nitro/task'

export default defineTask({
  meta: {
    name: 'prune',
    description: 'Prune accounts, sessions, email verifications, TOTPs, and RevenueCat webhook events.',
  },
  async run() {
    await pruneAll()
    return SuccessObject.fromData().toTaskResult()
  },
})
