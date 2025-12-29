export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path.startsWith('/totps')) {
    event.context.user = useUser(event)
  }
})
