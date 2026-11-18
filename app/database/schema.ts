import { useDatabase } from 'nitro/database'
import { useDatabaseWithMetadata } from '~/utils/db'

export const schemaUpgrade = [
  'CREATE TABLE IF NOT EXISTS totpBucketHeads (userId TEXT PRIMARY KEY, revision TEXT NOT NULL)',
  'CREATE TRIGGER IF NOT EXISTS deleteTotpBucketHead AFTER DELETE ON users BEGIN DELETE FROM totpBucketHeads WHERE userId = OLD.id; END',
  'CREATE TRIGGER IF NOT EXISTS cleanUserMetadata AFTER DELETE ON users BEGIN DELETE FROM sessions WHERE userId = OLD.id; DELETE FROM emailVerifications WHERE userId = OLD.id; END',
  `CREATE TRIGGER IF NOT EXISTS applyRevenueCatPlan AFTER INSERT ON revenueCatWebhookEvents
   WHEN NOT EXISTS (
     SELECT 1 FROM revenueCatWebhookEvents WHERE userId = NEW.userId
     AND (eventTimestamp, eventId) > (NEW.eventTimestamp, NEW.eventId)
   )
   BEGIN
     UPDATE users SET contributorPlan = CASE WHEN NEW.type IN ('EXPIRATION', 'TRANSFER_OUT') THEN 0 ELSE 1 END
     WHERE id = NEW.userId;
   END`,
]

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
  ...schemaUpgrade,
]

export const tables = ['totpBucketHeads', 'users', 'sessions', 'emailVerifications', 'revenueCatWebhookEvents']

let upgraded = false

/** Upgrade initialized installations on first use, including hosts that initialized an older release. */
export async function ensureSchemaUpgrade() {
  if (upgraded) return
  const database = useDatabase()
  if (['node-sqlite', 'better-sqlite3', 'sqlite3'].includes(database.connector)) {
    await database.exec('PRAGMA busy_timeout = 5000')
  }
  const db = useDatabaseWithMetadata()
  for (const sql of schemaUpgrade) {
    if (!(await db.prepare(sql).run()).success) throw new Error('Could not upgrade database schema.')
  }
  upgraded = true
}
