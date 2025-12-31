import type { AuthProvider } from '~/app/auth/providers/provider'

export type ProviderId = OAuthProviderId | 'email'
export type OAuthProviderId = `${AuthProviderId}Id`

export class User {
  public readonly id: string
  public readonly contributorPlan: boolean
  private readonly providersIds: Partial<Record<ProviderId, string>>

  private constructor(id: string, contributorPlan: boolean, providersIds: Partial<Record<ProviderId, string>> = {}) {
    this.id = id
    this.contributorPlan = contributorPlan
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

  static async createInDatabase(providersIds: Partial<Record<ProviderId, string>>, contributorPlan: boolean = false) {
    const userId = generateRandomString()

    const fields: string[] = ['id', 'contributorPlan']
    const values: (string | boolean)[] = [userId, contributorPlan]

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
    const values: (string | boolean)[] = []

    for (const providerId in options) {
      const value = (options as { [key: string]: string | boolean })[providerId]
      conditions.push(`${providerId} = ?`)
      values.push(value)
    }

    if (conditions.length === 0) {
      return null
    }

    const db = useDatabase()
    const row = await db
      .prepare(`SELECT * FROM users WHERE ${conditions.join(' AND ')} LIMIT 1`)
      .bind(...values)
      .get()

    if (!row || typeof row !== 'object') {
      return null
    }

    const { id, contributorPlan, ...unfilteredProvidersIds } = row as { id: string, contributorPlan: boolean } & Record<ProviderId, string | null>
    const providersIds = unfilteredProvidersIds as Record<ProviderId, string | null>
    const filteredProvidersIds: Partial<Record<ProviderId, string>> = {}
    for (const providerId in providersIds) {
      const value = providersIds[providerId as ProviderId]
      if (value) {
        filteredProvidersIds[providerId as ProviderId] = value
      }
    }
    return new User(id, contributorPlan, filteredProvidersIds)
  }

  async updateInDatabase(options: Partial<{ contributorPlan?: boolean } & Record<ProviderId, string | null>>) {
    const fields: string[] = []
    const values: (string | boolean | null)[] = []

    for (const option in options) {
      const value = (options as { [key: string]: string | boolean })[option]
      fields.push(`${option} = ?`)
      values.push(value)
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
}
