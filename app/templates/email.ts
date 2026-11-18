// Relative imports only : this file is loaded by the Nitro config.
import { escapeHtml } from '../../utils/html'

/** The default verification email. */
export const emailTemplates = {
  getSubject: () => 'Log in to Open Authenticator',
  getHtml: (_email: string, verificationCode: string, magicLink: string) => `<p>
  Hello,
</p>
<p>
  We have received a login request to Open Authenticator. To proceed, you can either enter the code
  <strong>${verificationCode}</strong> in the application or click the link below :
</p>
<p>
  &gt; <a href="${escapeHtml(magicLink)}">${escapeHtml(magicLink)}</a>
</p>
<p>
  If you haven't asked to log in, you can safely ignore this email.
</p>`,
  getText: (_email: string, verificationCode: string, magicLink: string) => `Hello,

We have received a login request to Open Authenticator. To proceed, you can either enter the code ${verificationCode} or open the link below in your browser :

${magicLink}

If you haven't asked to log in, you can safely ignore this email.`,
}
