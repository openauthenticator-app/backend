import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
  const db = useDatabaseWithMetadata()
  await db.prepare('DROP TABLE IF EXISTS users').run()
  await db.prepare('DROP TABLE IF EXISTS sessions').run()
  await db.prepare('DROP TABLE IF EXISTS emailVerifications').run()

  await db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, email TEXT, googleId TEXT, appleId TEXT, githubId TEXT, microsoftId TEXT, contributorPlan INTEGER NOT NULL DEFAULT 0)').run()
  await db.prepare('CREATE TABLE sessions (sessionId TEXT PRIMARY KEY, userId TEXT NOT NULL, appClientId TEXT NOT NULL, tokenHash TEXT NOT NULL, expiration INTEGER NOT NULL)').run()
  await db.prepare('CREATE TABLE emailVerifications (email TEXT NOT NULL, userId TEXT, verificationCode TEXT, authorizationCode TEXT, verificationCodeExpiration INTEGER, authorizationCodeExpiration INTEGER, cancelCode TEXT NOT NULL)').run()

  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_googleId_unique ON users(googleId)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_appleId_unique ON users(appleId)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_githubId_unique ON users(githubId)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_microsoftId_unique ON users(microsoftId)').run()

  await db.prepare('CREATE INDEX IF NOT EXISTS sessions_userId_expiration_index ON sessions(userId, expiration)').run()
  await db.prepare('CREATE INDEX IF NOT EXISTS sessions_expiration_index ON sessions(expiration)').run()

  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_email_unique ON emailVerifications(email)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_authorizationCode_unique ON emailVerifications(authorizationCode)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_cancelCode_unique ON emailVerifications(cancelCode)').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS emailVerifications_userId_unique ON emailVerifications(userId)').run()
  // await db.prepare('CREATE INDEX IF NOT EXISTS emailVerifications_email_verificationCode_index ON emailVerifications(email, verificationCode)').run()

  return SuccessObject.fromData().toResponse()
})
