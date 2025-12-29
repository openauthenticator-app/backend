import { TotpBucket, type User } from '~/app'

export default defineEventHandler(async (event) => {
  const bucket = TotpBucket.of(event.context.user as User)
  return await bucket.getAll()
})
