import pkg from '~/../package.json' assert { type: 'json' }

export default defineEventHandler(async () => {
  return `Greetings from Open Authenticator Backend v${pkg.version} !`
})
