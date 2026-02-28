import type { AuthProvider } from '~/app/auth/providers/provider'
import { TotpBucket } from '~/app/totp'

export type ProviderId = OAuthProviderId | 'email'
export type OAuthProviderId = `${AuthProviderId}Id`

export class User {
  public readonly id: string
  private readonly contributorPlan: boolean
  public readonly totpsLimit: number
  private readonly providersIds: Partial<Record<ProviderId, string>>

  private constructor(id: string, contributorPlan: boolean, providersIds: Partial<Record<ProviderId, string>> = {}) {
    this.id = id
    this.contributorPlan = contributorPlan
    this.totpsLimit = contributorPlan ? backendConfig.totps.limit.contributor : backendConfig.totps.limit.default
    this.providersIds = providersIds
  }

  static getAuthProviderFieldName(provider: AuthProvider): ProviderId {
    return provider.id === 'email' ? 'email' : `${provider.id}Id`
  }

  public hasProvider(provider: AuthProvider) {
    return User.getAuthProviderFieldName(provider) in this.providersIds
  }

  public getProviderCount() {
    return Object.keys(this.providersIds).length
  }

  static async createInDatabase(providersIds: Partial<Record<ProviderId, string>>, options: { contributorPlan?: boolean, userId?: string } = {}) {
    if (Object.keys(providersIds).length === 0) {
      return null
    }

    const userId = options.userId ?? generateRandomString()
    const contributorPlan = options.contributorPlan ?? false

    const fields: string[] = ['id', 'contributorPlan']
    const values: (string | number)[] = [userId, booleanToNumber(contributorPlan)]

    for (const providerId in providersIds) {
      const value = providersIds[providerId as ProviderId]
      if (value) {
        fields.push(providerId)
        values.push(value)
      }
    }

    const db = useDatabase()
    const { success } = await db
      .prepare(`INSERT INTO users (${fields.join(', ')}) VALUES (${values.map(() => '?').join(', ')})`)
      .bind(...values)
      .run()
    return success ? new User(userId, contributorPlan, providersIds) : null
  }

  static async findInDatabase(
    options: Partial<{ id?: string, contributorPlan?: boolean } & Record<ProviderId, string>>,
  ) {
    const conditions: string[] = []
    const values: (string | number)[] = []

    for (const option in options) {
      const value = (options as { [key: string]: string | boolean })[option]
      conditions.push(`${option} = ?`)
      values.push(typeof value === 'boolean' ? booleanToNumber(value) : value)
    }

    if (conditions.length === 0) {
      return null
    }

    const db = useDatabase()
    const dbUser = (await db
      .prepare(`SELECT * FROM users WHERE ${conditions.join(' AND ')} LIMIT 1`)
      .bind(...values)
      .get()) as DbUser | undefined

    if (!dbUser) {
      return null
    }

    const { id, contributorPlan, ...unfilteredProvidersIds } = dbUser
    const providersIds = unfilteredProvidersIds as Record<ProviderId, string | null>
    const filteredProvidersIds: Partial<Record<ProviderId, string>> = {}
    for (const providerId in providersIds) {
      const value = providersIds[providerId as ProviderId]
      if (value) {
        filteredProvidersIds[providerId as ProviderId] = value
      }
    }
    return new User(id, numberToBoolean(contributorPlan), filteredProvidersIds)
  }

  async updateInDatabase(options: Partial<{ contributorPlan?: boolean } & Record<ProviderId, string | null>>) {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    for (const option in options) {
      const value = (options as { [key: string]: string | boolean })[option]
      fields.push(`${option} = ?`)
      values.push(typeof value === 'boolean' ? booleanToNumber(value) : value ?? null)
    }

    if (fields.length === 0) {
      return true
    }

    values.push(this.id)
    const db = useDatabase()
    const { success } = await db
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    return success
  }

  async deleteFromDatabase(
    options?: {
      deleteSessions?: boolean
      deleteTotps?: boolean
    },
  ) {
    const db = useDatabase()
    let success = true
    if (options?.deleteSessions) {
      const { success: sessionDeleted } = await db
        .prepare(`DELETE FROM sessions WHERE userId = ?`)
        .bind(this.id)
        .run()
      success = success && sessionDeleted
    }
    if (options?.deleteTotps) {
      await TotpBucket.of(this).clear(true)
    }
    const { success: userDeleted } = await db
      .prepare(`DELETE FROM users WHERE id = ?`)
      .bind(this.id)
      .run()
    success = success && userDeleted
    return success
  }

  toJson() {
    return {
      id: this.id,
      contributorPlan: this.contributorPlan,
      totpsLimit: this.totpsLimit,
      providers: this.providersIds,
    }
  }
}

type DbUser = { id: string, contributorPlan: number } & Record<ProviderId, string | null>
