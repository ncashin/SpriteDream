import type { Database } from 'remix/data-table'
import { createContextKey, type Middleware } from 'remix/router'

import { db } from '../database.ts'

export const databaseContext = createContextKey<Database>()

export function loadDatabase(): Middleware<{
  key: typeof databaseContext
  value: Database
  property: 'database'
}> {
  return (context, next) => {
    context.set(databaseContext, db, { property: 'database' })
    return next()
  }
}
