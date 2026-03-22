import type { AppEvent } from '~/app'
import { defineHandler, type H3Event } from 'nitro/h3'

export default defineHandler({
  middleware: [
    rateLimit({
      limit: (event) => {
        const authProvider = useAuthProvider(event)
        return authProvider.id === 'email' ? 3 : 10
      },
    }),
  ],
  handler: async (event: H3Event) => {
    const authProvider = useAuthProvider(event)
    return SuccessObject.fromData(await authProvider.login(event as AppEvent)).toResponse()
  },
})
