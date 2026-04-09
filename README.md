<div align="center">
  <a href="https://openauthenticator.app">
    <img src="https://github.com/Skyost/OpenAuthenticator/raw/main/docs/public/images/logo.svg" alt="Logo" width="120" height="120">
  </a>

  <h3>Open Authenticator Backend</h3>

  <p>
    The backend of Open Authenticator.
    <br />
    <a href="/#self-hosting-instructions"><strong>Installation »</strong></a>
    <br />
    <br />
    <a href="https://openauthenticator.app">Website</a>
    ·
    <a href="https://github.com/openauthenticator-app/openauthenticator">App</a>
    ·
    <a href="https://github.com/openauthenticator-app/backend">Backend</a>
    ·
    <a href="https://openauthenticator.app/#contribute">Contribute</a>
  </p>
</div>

![GitHub License](https://img.shields.io/github/license/openauthenticator-app/backend)
![GitHub top language](https://img.shields.io/github/languages/top/openauthenticator-app/backend)
![GitHub Repo stars](https://img.shields.io/github/stars/openauthenticator-app/backend)

## About the app and this repository

[Open Authenticator](https://github.com/openauthenticator-app/openauthenticator) is a free, open-source and cross-platform TOTP manager. This repository contains the source code of its backend, allowing you to have access to your TOTPs on all your devices.

_If you like this project, consider starring it on GitHub !_

## Self-hosting instructions

### Requirements

Open Authenticator Backend is powered by [Nitro](https://nitro.build/). You will need the following in order to be able to run it :

* A **Node.js environment**. Either a server or a serverless environment (eg. Cloudflare, Vercel, ...).
* A **database**. The connector should be compatible with [DB0](https://db0.unjs.io) (see all available connectors [here](https://db0.unjs.io/connectors)). This is where all users' information will be stored.
* A **storage**. The connector should be compatible with [unstorage](https://unstorage.unjs.io) (see all available drivers [here](https://unstorage.unjs.io/drivers)). This is where all TOTPs will be stored.
* An **email account**, for sending magic links.
* Optionally, a key-value storage provider, for storing rate limiting related data.

### Installation

The backend is still in development. To install it, currently, you only have to clone the repository and build it.

```sh
git clone https://github.com/openauthenticator-app/backend.git
cd backend
npm install
npm run build
```

To start it :

```sh
npm run start
```

### Configuration

To configure the backend, you'll have to edit `backend.config.ts`. For example, to host it on Cloudflare, you may want to configure it like this :

```ts
// noinspection ES6PreferShortImport
import { defineBackendConfig } from './utils/config'

export default defineBackendConfig({
  enableRegistrations: false, // You can disable new user registrations if needed.
  totps: {
    storage: {
      driver: 'cloudflare-r2-binding',
      binding: 'BUCKET',
    },
  },
  authentication: {
    database: {
      connector: 'cloudflare-d1',
      options: {
        // @ts-expect-error `bindingName` is not in the type definition.
        bindingName: 'DATABASE',
      },
    },
    providers: {
      email: {
        library: 'workermailer',
        host: 'smtp.example.com',
        port: 587,
        username: 'noreply@example.com',
        password: process.env.EMAIL_PASSWORD
      },
    },
  },
  rateLimiter: {
    storage: {
      driver: 'cloudflare-kv-binding',
      binding: 'STORAGE',
    },
  },
})
```

with bindings configured in a [`wrangler.json`](https://developers.cloudflare.com/pages/functions/bindings/) file. You may also need to configure some environment variables :

```env
NODE_ENV='production' # You should be in production.
URL='https://example.com' # Your backend URL.
ADMIN_HEADER='Bearer SECURE_RANDOM_STRING' # Allows to access /admin/* routes.
JWT_ACCESS_SECRET='ANOTHER_SECURE_RANDOM_STRING' # Used to encrypt access tokens.
JWT_REFRESH_SECRET='ANOTHER_ANOTHER_SECURE_RANDOM_STRING' # Used to encrypt refresh tokens.
JWT_REFRESH_PEPPER='ANOTHER_ANOTHER_ANOTHER_SECURE_RANDOM_STRING' # Used to encrypt refresh tokens.
EMAIL_PASSWORD='YOUR_PASSWORD' # Used in the example above to authenticate your email address.
```

For additional options, please refer to [the default config](https://github.com/openauthenticator-app/backend/blob/dev/app/config.ts#L75).

> [!NOTE]
> Don't forget to rebuild the server after each configuration change.

### Populate, reset and prune data

To (re)create the default tables, you'll have to head to `/admin/reset` with your previously defined `ADMIN_HEADER` set as the `Authorization` header. To prune unnecessary data, go to `/admin/prune`.

### Using it in the app

To use your own backend in the app, you'll have to go to the settings, and then choose _Change backend URL_. Put your own backend URL here, et voilà !

## License

Open Authenticator Backend is licensed under the [GNU General Public License v3.0](https://choosealicense.com/licenses/gpl-3.0/).

## Contribute

If you like this project, there are a lot of ways for you to contribute to it !
Please read the [contribution guide](/blob/main/CONTRIBUTING.md) before getting started.

### Report bugs or suggest new features

You can report bugs or suggest new features in the [issue tracker](/issues).

### Donate

You can donate for this project using either [PayPal](http://paypal.me/Skyost), [Ko-Fi](https://ko-fi.com/Skyost) or [Github sponsors](https://github.com/sponsors/Skyost). If you don't want to donate, any [kind message](https://openauthenticator.app/contact) is also appreciated !
