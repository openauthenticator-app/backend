/**
 * The database schema. All statements are idempotent.
 */
export const schema = [
  'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT, googleId TEXT, appleId TEXT, githubId TEXT, microsoftId TEXT, contributorPlan INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS sessions (sessionId TEXT PRIMARY KEY, userId TEXT NOT NULL, appClientId TEXT NOT NULL, tokenHash TEXT NOT NULL, expiration INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS emailVerifications (email TEXT NOT NULL, userId TEXT, verificationCode TEXT, authorizationCode TEXT, verificationCodeExpiration INTEGER, authorizationCodeExpiration INTEGER, cancelCode TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS revenueCatWebhookEvents (eventId TEXT NOT NULL, userId TEXT NOT NULL, eventTimestamp INTEGER NOT NULL, type TEXT NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY (eventId, userId))',

  'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)',
  'CREATE UNIQUE INDEX IF NOT EXISTS users_googleId_unique ON users(googleId)',
  'CREATE UNIQUE INDEX IF NOT EXISTS users_appleId_unique ON users(appleId)',
  'CREATE UNIQUE INDEX IF NOT EXISTS users_githubId_unique ON users(githubId)',
  'CREATE UNIQUE INDEX IF NOT EXISTS users_microsoftId_unique ON users(microsoftId)',

  'CREATE INDEX IF NOT EXISTS sessions_userId_expiration_index ON sessions(userId, expiration)',
  'CREATE INDEX IF NOT EXISTS sessions_expiration_index ON sessions(expiration)',

  'CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_email_unique ON emailVerifications(email)',
  'CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_authorizationCode_unique ON emailVerifications(authorizationCode)',
  'CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_cancelCode_unique ON emailVerifications(cancelCode)',
  'CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_userId_unique ON emailVerifications(userId)',

  'CREATE INDEX IF NOT EXISTS revenueCatWebhookEvents_userId_eventTimestamp_index ON revenueCatWebhookEvents(userId, eventTimestamp)',
]

export const tables = ['users', 'sessions', 'emailVerifications', 'revenueCatWebhookEvents']
