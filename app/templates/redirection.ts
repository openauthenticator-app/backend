// Relative imports only : this file is loaded by the Nitro config.
import { escapeHtml } from '../../utils/html'

/** Builds the default page that redirects the user to the app. */
export const buildRedirectionPage = (url: URL | string): string => {
  const htmlUrl = escapeHtml(url.toString())
  const jsUrl = JSON.stringify(url.toString()).replaceAll('<', '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${htmlUrl}" />
  <title>Open Authenticator</title>
  <script>window.location.href = ${jsUrl};</script>
</head>
<body>
  <p>
    Redirecting you to the Open Authenticator app...
    Please click <a href="${htmlUrl}">here</a> if you're not being redirected.
  </p>
</body>
</html>`
}
