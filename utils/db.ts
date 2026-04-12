import type { Database, PreparedStatement, Primitive, Statement } from 'db0'
import { useDatabase } from 'nitro/database'

export interface PreparedRunResult {
  lastInsertRowid?: number
  changes?: number
  error?: string
  rows?: {
    id?: string | number
    [key: string]: unknown
  }[]
  success: boolean
}

function toTemplateStringsArray(parts: string[]): TemplateStringsArray {
  const result = [...parts] as unknown as TemplateStringsArray
  Object.defineProperty(result, 'raw', {
    value: [...parts],
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return result
}

function splitSqlPlaceholders(sql: string): string[] {
  return sql.split('?')
}

function countSqlPlaceholders(sql: string): number {
  return splitSqlPlaceholders(sql).length - 1
}

async function runWithMetadata(
  db: Database,
  sql: string,
  params: Primitive[],
): Promise<PreparedRunResult> {
  const placeholderCount = countSqlPlaceholders(sql)
  if (placeholderCount !== params.length) {
    throw new Error(
      `Invalid SQL binding count: expected ${placeholderCount} parameter(s), got ${params.length}. SQL: ${sql}`,
    )
  }

  const parts = splitSqlPlaceholders(sql)
  const templateStrings = toTemplateStringsArray(parts)

  const result = await db.sql(templateStrings, ...params)
  return {
    lastInsertRowid: result.lastInsertRowid,
    changes: result.changes,
    error: result.error,
    rows: result.rows,
    success: result.success === true,
  }
}

class PreparedStatementWithMetadata implements PreparedStatement {
  private readonly db: Database
  private readonly sql: string
  private readonly preparedStatement: PreparedStatement
  private readonly params: Primitive[]

  constructor(
    db: Database,
    sql: string,
    preparedStatement: PreparedStatement,
    params: Primitive[] = [],
  ) {
    this.db = db
    this.sql = sql
    this.preparedStatement = preparedStatement
    this.params = params
  }

  bind(...params: Primitive[]): PreparedStatementWithMetadata {
    return new PreparedStatementWithMetadata(
      this.db,
      this.sql,
      this.preparedStatement.bind(...params),
      params,
    )
  }

  async run(): Promise<PreparedRunResult> {
    return await runWithMetadata(this.db, this.sql, this.params)
  }

  async get(): Promise<unknown> {
    return await this.preparedStatement.get()
  }

  async all(): Promise<unknown[]> {
    return await this.preparedStatement.all()
  }
}

class StatementWithMetadata implements Statement {
  private readonly db: Database
  private readonly sql: string
  private readonly statement: Statement

  constructor(db: Database, sql: string) {
    this.db = db
    this.sql = sql
    this.statement = db.prepare(sql)
  }

  bind(...params: Primitive[]): PreparedStatementWithMetadata {
    return new PreparedStatementWithMetadata(
      this.db,
      this.sql,
      this.statement.bind(...params),
      params,
    )
  }

  async run(...params: Primitive[]): Promise<PreparedRunResult> {
    return await runWithMetadata(this.db, this.sql, params)
  }

  async get(...params: Primitive[]): Promise<unknown> {
    return await this.statement.get(...params)
  }

  async all(...params: Primitive[]): Promise<unknown[]> {
    return await this.statement.all(...params)
  }
}

interface DatabaseWithMetadata extends Database {
  prepare: (sql: string) => StatementWithMetadata
}

export const useDatabaseWithMetadata = (name?: string): DatabaseWithMetadata => {
  const db = useDatabase(name)
  return {
    ...db,
    prepare: (sql: string) => new StatementWithMetadata(db, sql),
  }
}

export const hasExactlyOneChange = (result: PreparedRunResult) => !!result.success && result.changes === 1
