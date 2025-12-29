import type { AuthProvider } from '~/app/auth/providers/provider'

export type ProviderId = OAuthProviderId | 'email'
export type OAuthProviderId = `${AuthProviderId}Id`

export class User {
  public id: string
  private readonly providersIds: Partial<Record<ProviderId, string>>

  private constructor(id: string, providersIds: Partial<Record<ProviderId, string>> = {}) {
    this.id = id
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

  static async createInDatabase(options: Partial<Record<ProviderId, string>>) {
    const userId = generateRandomString()

    const fields: string[] = ['id']
    const values: string[] = [userId]

    for (const option in options) {
      const value = options[option as ProviderId]
      if (value) {
        fields.push(option)
        values.push(value)
      }
    }

    const db = useDatabase()
    const { success } = await db
      .prepare(`INSERT INTO users (${fields.join(', ')}) VALUES (${values.map(() => '?').join(', ')})`)
      .bind(...values)
      .run()
    return success ? new User(userId, options) : null
  }

  static async findInDatabase(
    options: { id?: string } & Partial<Record<ProviderId, string>>,
  ) {
    const conditions: string[] = []
    const values: string[] = []

    for (const providerId in options) {
      const value = options[providerId as ProviderId]
      if (value) {
        conditions.push(`${providerId} = ?`)
        values.push(value)
      }
    }

    if (conditions.length === 0) {
      return null
    }

    const db = useDatabase()
    const row = await db
      .prepare(`SELECT * FROM users WHERE ${conditions.join(' AND ')} LIMIT 1`)
      .bind(...values)
      .get()

    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string') {
      return null
    }

    const { id, ...unfilteredProvidersIds } = row
    const providersIds = unfilteredProvidersIds as Record<ProviderId, string | null>
    const filteredProvidersIds: Partial<Record<ProviderId, string>> = {}
    for (const providerId in providersIds) {
      const value = providersIds[providerId as ProviderId]
      if (value) {
        filteredProvidersIds[providerId as ProviderId] = value
      }
    }
    return new User(id, filteredProvidersIds)
  }

  async updateInDatabase(options: Partial<Record<ProviderId, string | null>>) {
    const fields: string[] = []
    const values: (string | null)[] = []

    for (const option in options) {
      const value = options[option as ProviderId]
      if (typeof value === 'string' || value === null) {
        fields.push(`${option} = ?`)
        values.push(value)
      }
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
