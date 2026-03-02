import pkg from '~/../package.json' assert { type: 'json' }

export default defineEventHandler(async () => `Greetings from Open Authenticator Backend v${pkg.version} !`)
