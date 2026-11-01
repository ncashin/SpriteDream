import { column, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

/** `id` is the project folder path. */
export const projects = table({
  name: 'projects',
  columns: {
    id: column.text(),
    name: column.text(),
    last_opened: column.integer(),
  },
})

export type Project = TableRow<typeof projects>
