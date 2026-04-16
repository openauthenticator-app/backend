import { defineHandler } from 'nitro/h3'
import pkg from '~/package.json' with { type: 'json' }

export default defineHandler(async () => `Greetings from Open Authenticator Backend v${pkg.version} !`)
