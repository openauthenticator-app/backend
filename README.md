<div align="center">
  <a href="https://openauthenticator.app">
    <img src="https://openauthenticator.app/images/logo.svg" alt="Logo" width="120" height="120">
  </a>

  <h3>Open Authenticator Backend</h3>

  <p>
    The backend of Open Authenticator.
    <br />
    <a href="#installation"><strong>Installation »</strong></a>
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

  <p>
    <img src="https://img.shields.io/github/license/openauthenticator-app/backend" alt="License">
    <img src="https://img.shields.io/github/languages/top/openauthenticator-app/backend" alt="Top language">
    <img src="https://img.shields.io/github/stars/openauthenticator-app/backend" alt="GitHub stars">
  </p>
</div>

## About the app and this repository

[Open Authenticator](https://github.com/openauthenticator-app/openauthenticator) is a free, open-source and cross-platform TOTP manager. This repository contains the source code of its backend, allowing you to have access to your TOTPs on all your devices.

> [!TIP]
> If you like this project, consider starring it on GitHub !

## Self-hosting instructions

### Requirements

Open Authenticator Backend is powered by [Nitro](https://nitro.build/). You will need the following in order to be able to run it :

* A **Node.js environment** and the [pnpm](https://pnpm.io/) package manager. Either a server or a serverless environment (eg. Cloudflare, Vercel, ...).
* A **database**. The connector should be compatible with [DB0](https://db0.unjs.io) (see all available connectors [here](https://db0.unjs.io/connectors)). This is where all users' information will be stored.
* A **storage**. The connector should be compatible with [unstorage](https://unstorage.unjs.io) (see all available drivers [here](https://unstorage.unjs.io/drivers)). This is where all TOTPs will be stored.
* _Optionally_, an **email account**, for sending magic links.
* _Optionally_, a key-value storage provider, for storing rate limiting related data.

### Installation

The backend is still in development. To install it, currently, you only have to clone the repository and build it.

```sh
git clone https://github.com/openauthenticator-app/backend.git
cd backend
pnpm install
pnpm build
```

And to start it :

```sh
pnpm start
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
ADMIN_HEADER='Bearer SECURE_RANDOM_STRING' # Required to access /admin/* routes.
JWT_ACCESS_SECRET='ANOTHER_SECURE_RANDOM_STRING' # Used to encrypt access tokens.
JWT_REFRESH_SECRET='ANOTHER_ANOTHER_SECURE_RANDOM_STRING' # Used to encrypt refresh tokens.
JWT_REFRESH_PEPPER='ANOTHER_ANOTHER_ANOTHER_SECURE_RANDOM_STRING' # Used to encrypt refresh tokens.
EMAIL_PASSWORD='YOUR_PASSWORD' # Used in the example above to authenticate your email address.
```

The following table lists all available configuration options, along with their default values.
Use `backend.config.ts` to override them.

| Option                                    | Default                                        | Description                                                                                                                                                                                       |
|-------------------------------------------|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `url`                                     | `process.env.URL`                              | Public backend URL, used to build OAuth callbacks and magic links.                                                                                                                                |
| `appVersionRange`                         | `>=2.0.0 <3.0.0`                               | Supported application version range checked against the `App-Version` header.                                                                                                                     |
| `enableRegistrations`                     | `true`                                         | Allows creating new users when a valid login does not match an existing account.                                                                                                                  |
| `adminHeader`                             | `process.env.ADMIN_HEADER`                     | Expected `Authorization` header for `/admin/*` routes.                                                                                                                                            |
| `redirectionPageBuilder`                  | Default HTML redirect page builder             | Builds the HTML page returned during app redirection flows. Receives the target URL and optional locale.                                                                                          |
| `totps.storage`                           | `{ driver: 'memory' }`                         | Unstorage-compatible storage configuration for encrypted TOTP data.                                                                                                                               |
| `totps.limit.default`                     | `6`                                            | Maximum number of TOTPs for regular users.                                                                                                                                                        |
| `totps.limit.contributor`                 | `100`                                          | Maximum number of TOTPs for contributor users.                                                                                                                                                    |
| `authentication.strategy`                 | `hybrid`                                       | Session strategy. `stateless` uses JWTs only, `hybrid` stores refresh sessions but validates access tokens without a DB lookup, and `stateful` checks the session database for access tokens too. |
| `authentication.database`                 | SQLite `db`                                    | DB0-compatible database used for users, stateful/hybrid refresh sessions, and email verification records.                                                                                         |
| `authentication.tokensTtl.access`         | `15m`                                          | Access token lifetime.                                                                                                                                                                            |
| `authentication.tokensTtl.refresh`        | `60d`                                          | Refresh token lifetime.                                                                                                                                                                           |
| `authentication.cookiesOptions`           | `HttpOnly`, `Secure`, `SameSite=Lax`, path `/` | Cookie options used during OAuth redirect flows.                                                                                                                                                  |
| `authentication.jwtSecrets.access`        | `process.env.JWT_ACCESS_SECRET`                | Secret used to sign access tokens.                                                                                                                                                                |
| `authentication.jwtSecrets.refresh`       | `process.env.JWT_REFRESH_SECRET`               | Secret used to sign refresh tokens.                                                                                                                                                               |
| `authentication.jwtSecrets.refreshPepper` | `process.env.JWT_REFRESH_PEPPER`               | Pepper used to hash refresh tokens before storing them when stateful auth is enabled.                                                                                                             |
| `authentication.providers.google`         | Environment variables                          | Google OAuth client configuration.                                                                                                                                                                |
| `authentication.providers.apple`          | Environment variables                          | Apple OAuth client configuration.                                                                                                                                                                 |
| `authentication.providers.github`         | Environment variables                          | GitHub OAuth client configuration.                                                                                                                                                                |
| `authentication.providers.microsoft`      | Environment variables                          | Microsoft OAuth client configuration.                                                                                                                                                             |
| `authentication.providers.email`          | `nodemailer` with environment defaults         | Email provider used for magic-link/code login. Supports the mailer libraries exposed by the backend email module.                                                                                 |
| `sentryDsn`                               | `process.env.SENTRY_DSN`                       | Optional Sentry DSN.                                                                                                                                                                              |
| `revenueCat.contributorPlanEntitlementId` | `contributor_plan`                             | RevenueCat entitlement ID used to identify contributor users.                                                                                                                                     |
| `revenueCat.authorizationHeader`          | `process.env.REVENUECAT_AUTHORIZATION_HEADER`  | Expected `Authorization` header for RevenueCat webhooks.                                                                                                                                          |
| `rateLimiter.enable`                      | `true`                                         | Enables route rate limiting.                                                                                                                                                                      |
| `rateLimiter.storage`                     | `{ driver: 'memory' }`                         | Unstorage-compatible storage configuration for rate-limit counters.                                                                                                                               |

Please refer to [the default config](https://github.com/openauthenticator-app/backend/blob/dev/app/config.ts#L75).

> [!NOTE]
> Don't forget to rebuild the server after each configuration change.

### Populate, reset and prune data

To (re)create the default tables, send a `POST` request to `/admin/reset` with your previously defined `ADMIN_HEADER` set as the `Authorization` header. To prune unnecessary data, send a `POST` request to `/admin/prune`. You can also prune only one category with `/admin/prune/accounts`, `/admin/prune/sessions`, `/admin/prune/email-verifications`, `/admin/prune/totps`, or `/admin/prune/revenuecat`.

## Behind the scenes

### Request requirements

Most application routes require two headers :

- `App-Version`, which must satisfy `appVersionRange`.
- `App-Client-Id`, a stable identifier for the current app installation/client.

These headers are required for `/auth/*`, `/totps/*`, `/user/*`, and `/ping`, except OAuth and email callback/redirect endpoints. Admin routes additionally require the configured `adminHeader` as the `Authorization` header.

### Routes

| Route                               | Method   | Purpose                                                                                                                                                                      | Authentication                                                   |
|-------------------------------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| `/ping`                             | `GET`    | Health/version-compatible ping endpoint.                                                                                                                                     | App headers                                                      |
| `/auth/provider/:provider/redirect` | `GET`    | Starts an OAuth or email login/link flow. Supported providers are `google`, `apple`, `microsoft`, `github`, and `email` depending on what configured in `backend.config.ts`. | Public, provider-specific                                        |
| `/auth/provider/:provider/callback` | `GET`    | Handles OAuth provider redirects and returns an app deep link.                                                                                                               | Public, protected by OAuth `state`/PKCE cookies where applicable |
| `/auth/provider/:provider/callback` | `POST`   | Handles Apple and email callbacks that post data. Sends a redirection for Apple.                                                                                             | Provider-specific                                                |
| `/auth/provider/:provider/login`    | `POST`   | Exchanges a provider authorization code for backend `accessToken` and `refreshToken`.                                                                                        | App headers                                                      |
| `/auth/provider/:provider/link`     | `POST`   | Links a provider identity to the current user.                                                                                                                               | Bearer access token                                              |
| `/auth/provider/:provider/unlink`   | `POST`   | Unlinks a provider identity from the current user.                                                                                                                           | Bearer access token                                              |
| `/auth/provider/:provider/cancel`   | `POST`   | Cancels a pending email login request.                                                                                                                                       | Email provider only                                              |
| `/auth/refresh`                     | `POST`   | Exchanges a refresh token for a new token pair.                                                                                                                              | Refresh token + app headers                                      |
| `/auth/logout`                      | `POST`   | Revokes the refresh token in stateful mode. In stateless mode, validates the token but cannot revoke it server-side.                                                         | Refresh token + app headers                                      |
| `/user`                             | `GET`    | Returns the current user profile.                                                                                                                                            | Bearer access token                                              |
| `/user`                             | `DELETE` | Deletes the current user, sessions, and TOTP data.                                                                                                                           | Bearer access token                                              |
| `/totps`                            | `GET`    | Returns all encrypted TOTPs for the current user.                                                                                                                            | Bearer access token                                              |
| `/totps`                            | `POST`   | Replaces/sets encrypted TOTPs in bulk.                                                                                                                                       | Bearer access token                                              |
| `/totps`                            | `DELETE` | Clears all encrypted TOTPs for the current user.                                                                                                                             | Bearer access token                                              |
| `/totps/:uuid`                      | `POST`   | Sets one encrypted TOTP.                                                                                                                                                     | Bearer access token                                              |
| `/totps/:uuid`                      | `DELETE` | Deletes one encrypted TOTP and stores a tombstone for sync.                                                                                                                  | Bearer access token                                              |
| `/totps/sync/pull`                  | `POST`   | Returns inserts, updates, and deletes newer than the client-known timestamps.                                                                                                | Bearer access token                                              |
| `/totps/sync/push`                  | `POST`   | Applies compacted client sync operations with timestamp conflict checks.                                                                                                     | Bearer access token                                              |
| `/admin/reset`                      | `POST`   | Drops and recreates database tables and indexes.                                                                                                                             | `adminHeader`                                                    |
| `/admin/prune`                      | `POST`   | Prunes inactive accounts, expired sessions, expired email verifications, deleted TOTP tombstones, and processed RevenueCat webhook events.                                     | `adminHeader`                                                    |
| `/admin/prune/accounts`             | `POST`   | Prunes inactive non-contributor accounts. Accepts an optional `days` value in the JSON body.                                                                                 | `adminHeader`                                                    |
| `/admin/prune/sessions`             | `POST`   | Prunes expired sessions.                                                                                                                                                     | `adminHeader`                                                    |
| `/admin/prune/email-verifications`  | `POST`   | Prunes expired email verification records.                                                                                                                                   | `adminHeader`                                                    |
| `/admin/prune/totps`                | `POST`   | Prunes deleted TOTP tombstones. Accepts an optional `days` value in the JSON body.                                                                                           | `adminHeader`                                                    |
| `/admin/prune/revenuecat`           | `POST`   | Prunes processed RevenueCat webhook events. Accepts an optional `days` value in the JSON body.                                                                               | `adminHeader`                                                    |
| `/webhooks/revenuecat`              | `POST`   | Handles RevenueCat subscription events.                                                                                                                                      | RevenueCat `Authorization` header                                |

### Authentication flow

Authentication is provider-based. OAuth providers use `state` cookies, and providers that support PKCE store a temporary code verifier cookie during the redirect flow. The provider callback returns an app deep link containing a provider authorization code. The app then calls `/auth/provider/:provider/login`, and the backend validates that authorization code before issuing backend tokens.

The email provider sends a verification code and magic link. A valid email callback creates a short-lived backend authorization code, which is then exchanged through the same `/auth/provider/email/login` endpoint.

Provider linking uses the same provider validation path as login, but requires an existing bearer access token. A user cannot unlink the last remaining provider from their account.

### Sessions and tokens

The backend issues two JWTs :

- An access token, sent as `Authorization: Bearer <token>` for protected routes.
- A refresh token, sent in the JSON body to `/auth/refresh` and `/auth/logout`.

Both tokens include the user id as `sub`, a session id as `sid`, the token kind as `typ`, and the app client id as `aci`. The `typ` claim must match the expected token kind (`access` or `refresh`), and the `aci` claim must match the `App-Client-Id` header.

With `authentication.strategy = 'stateless'`, the backend does not write login or refresh sessions to the `sessions` table. Access and refresh tokens are accepted based on JWT signature, expiration, token kind, and app-client binding. This mode avoids session database I/O, but logout cannot revoke already issued tokens server-side; invalidation relies on token expiration or JWT secret rotation.

With `authentication.strategy = 'hybrid'`, access tokens are validated from the JWT only, while refresh tokens remain backed by the `sessions` table. The backend stores only a peppered hash of the refresh token, together with the user id, app client id, and expiration timestamp. Refreshing deletes the previous session row and creates a new one. Logout deletes the matching session row. Already issued access tokens remain valid until they expire.

With `authentication.strategy = 'stateful'`, refresh tokens use the same stateful storage as `hybrid`, and access tokens are also checked against the `sessions` table on protected requests. Logout and refresh invalidation therefore take effect immediately for access tokens too, at the cost of one database lookup per authenticated request.

### Rate limits

Rate limiting is controlled by `rateLimiter.enable` and uses the configured `rateLimiter.storage` through Unstorage. Keys are scoped by client IP and route path by default. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`; limited responses include `Retry-After` and return `429`.

The default middleware uses a sliding-window algorithm. Most route-specific limits use the default one-minute window. Notable custom limits include :

- `/auth/provider/:provider/redirect`: 3 requests per 15 minutes for email, keyed by IP, path, and normalized email; 20 requests per 15 minutes for other providers.
- `/auth/provider/:provider/login`: 3 requests for email, 10 for other providers.
- `/auth/refresh`: 5 requests.
- `/totps` bulk operations: 5 requests.
- `/user` delete: 1 request.

### RevenueCat webhook

`/webhooks/revenuecat` verifies the incoming `Authorization` header against `revenueCat.authorizationHeader` using a timing-safe comparison. If subscriber attributes include a `backend` value, it must match the configured backend hostname.

Handled RevenueCat events update the local `contributorPlan` flag :

- `INITIAL_PURCHASE`, `RENEWAL`, and `TEMPORARY_ENTITLEMENT_GRANT` grant contributor access when the event contains `revenueCat.contributorPlanEntitlementId`.
- `EXPIRATION` removes contributor access for that entitlement.
- `TRANSFER` removes contributor access from every previous RevenueCat user and grants it to every new one when those users exist locally.
- Unknown event types are accepted but only logged.

Processed RevenueCat events are tracked in the `revenueCatWebhookEvents` table, one row per event and per affected user. This makes retries idempotent and prevents an older webhook from overriding a newer subscription state.

### Using it in the app

To use your own backend in the app, you'll have to go to the settings, and then choose _Change backend URL_. Put your own backend URL here, et voilà !

## Contributing

Contributions are more than welcome. For setup details, contribution rules and PR expectations, read the
[guidelines](https://github.com/openauthenticator-app/backend/blob/main/CONTRIBUTING.md).

You can also help by :

- reporting bugs or suggesting features in the
  [issue tracker](https://github.com/openauthenticator-app/backend/issues) ;
- submitting fixes for documentation, UI text or code.

## Support the project

If you want to support Open Authenticator financially, you can use :

- [Ko-fi](https://ko-fi.com/Skyost)
- [PayPal](https://paypal.me/Skyost)
- [GitHub Sponsors](https://github.com/sponsors/Skyost)

## License

Open Authenticator Backend is licensed under the
[GNU General Public License v3.0](https://github.com/openauthenticator-app/backend/blob/main/LICENSE).
