import type { Database, Primitive } from 'db0'
import { useDatabase } from 'nitro/database'

export interface PreparedRunResult {
  changes?: number
  success: boolean
}

export interface BoundStatement {
  run(): Promise<PreparedRunResult>
  get(): Promise<unknown>
  all(): Promise<unknown[]>
}

export interface Statement extends BoundStatement {
  bind(...params: Primitive[]): BoundStatement
}

/**
 * db0 prepared statements do not return the number of changed rows when running a query, but `db.sql` does.
 * So `run()` goes through `db.sql`, by converting the `?` placeholders into template parameters.
 */
const runWithMetadata = async (db: Database, sql: string, params: Primitive[]): Promise<PreparedRunResult> => {
  const parts = sql.split('?')
  if (parts.length - 1 !== params.length) {
    throw new Error(`Invalid SQL binding count: expected ${parts.length - 1} parameter(s), got ${params.length}. SQL: ${sql}`)
  }
  const strings = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray
  const result = await db.sql(strings, ...params)
  return {
    changes: result.changes,
    success: result.success === true,
  }
}

export const useDatabaseWithMetadata = (name?: string) => {
  const db = useDatabase(name)
  return {
    prepare: (sql: string): Statement => {
      const bind = (...params: Primitive[]): BoundStatement => ({
        run: () => runWithMetadata(db, sql, params),
        get: () => db.prepare(sql).get(...params),
        all: () => db.prepare(sql).all(...params),
      })
      return { ...bind(), bind }
    },
  }
}

export const hasExactlyOneChange = (result: PreparedRunResult) => result.success && result.changes === 1
