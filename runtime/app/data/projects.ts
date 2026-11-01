import { basename } from 'node:path'
import type { Database } from 'remix/data-table'

import { projects } from './tables.ts'

export async function rememberProject(database: Database, directory: string) {
  const lastOpened = Date.now()
  const name = basename(directory)
  const existing = await database.findOne(projects, { where: { directory } })

  if (existing) {
    await database.update(projects, existing.id, { name, last_opened: lastOpened })
    return
  }

  await database.create(projects, {
    id: crypto.randomUUID(),
    directory,
    name,
    last_opened: lastOpened,
  })
}
