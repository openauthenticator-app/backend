import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
  const db = useDatabase()
  await db.prepare('BEGIN').run()
  await db.prepare('DROP TABLE IF EXISTS users').run()
  await db.prepare('DROP TABLE IF EXISTS sessions').run()
  await db.prepare('DROP TABLE IF EXISTS emailVerifications').run()
  await db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NULLABLE, googleId TEXT NULLABLE, appleId TEXT NULLABLE, githubId TEXT NULLABLE, microsoftId TEXT NULLABLE, contributorPlan INTEGER NULLABLE)').run()
  await db.prepare('CREATE TABLE sessions (sessionId TEXT PRIMARY KEY, userId TEXT NOT NULL, appClientId TEXT NOT NULL, tokenHash TEXT NOT NULL, expiration INTEGER NOT NULL)').run()
  await db.prepare('CREATE TABLE emailVerifications (email TEXT NOT NULL, userId TEXT, verificationCode TEXT NULLABLE, authorizationCode TEXT NULLABLE, verificationCodeExpiration INTEGER NULLABLE, authorizationCodeExpiration INTEGER NULLABLE, cancelCode TEXT)').run()
  await db.prepare('COMMIT').run()
  return SuccessObject.fromData()
})
