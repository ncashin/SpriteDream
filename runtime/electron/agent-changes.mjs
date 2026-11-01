import { readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { defaultRoots, discoverSessions, loadSessionFromPath } from '@razroo/iso-trace'

import { projectDirectory } from './project-files.mjs'

const openedAt = new Map()
const countedSessions = new Map()

function insideProject(folder, filePath) {
  if (typeof filePath !== 'string' || filePath === '') return false

  const absolute = isAbsolute(filePath) ? filePath : resolve(folder, filePath)
  const fromRoot = relative(folder, absolute)
  return fromRoot !== '' && !fromRoot.startsWith('..') && !fromRoot.split(sep).includes('..')
}

function transcriptsChangedSince(since) {
  const files = []

  function walk(current) {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.name.endsWith('.jsonl')) continue

      try {
        if (statSync(path).mtimeMs >= since) files.push(path)
      } catch {
        // The transcript disappeared between the listing and the stat.
      }
    }
  }

  for (const source of defaultRoots()) {
    if (!source.exists || source.harness === 'opencode') continue
    walk(source.root)
  }

  return files
}

async function openCodeSessionsChangedSince(since) {
  const source = defaultRoots().find((item) => item.harness === 'opencode' && item.exists)
  if (!source) return []

  const refs = await discoverSessions({ harness: 'opencode', roots: [source.root] })
  return refs.filter((ref) => {
    const at = Date.parse(ref.endedAt ?? ref.startedAt)
    return Number.isFinite(at) && at >= since
  })
}

function editsInSession(path, folder, since, harness) {
  let mtimeMs = 0
  try {
    mtimeMs = statSync(path).mtimeMs
  } catch {
    countedSessions.delete(path)
    return 0
  }

  const cached = countedSessions.get(path)
  if (cached && cached.mtimeMs === mtimeMs && cached.since === since && cached.folder === folder) {
    return cached.count
  }

  const count = countEdits(
    harness ? loadSessionFromPath(path, harness) : loadSessionFromPath(path),
    folder,
    since,
  )
  countedSessions.set(path, { mtimeMs, since, folder, count })
  return count
}

function countEdits(session, folder, since) {
  let count = 0

  for (const turn of session.turns) {
    const at = Date.parse(turn.at)
    if (!Number.isFinite(at) || at < since) continue

    for (const event of turn.events) {
      if (event.kind !== 'file_op' || (event.op !== 'write' && event.op !== 'edit')) continue
      if (insideProject(folder, event.path)) count += 1
    }
  }

  return count
}

export async function agentEditCount(directory) {
  const folder = projectDirectory(directory)
  if (!folder) return 0

  if (!openedAt.has(folder)) openedAt.set(folder, Date.now())
  const since = openedAt.get(folder)
  let count = 0

  for (const path of transcriptsChangedSince(since)) {
    try {
      count += editsInSession(path, folder, since)
    } catch {
      // A transcript iso-trace cannot parse yet is skipped.
    }
  }

  for (const ref of await openCodeSessionsChangedSince(since)) {
    try {
      count += editsInSession(ref.source.path, folder, since, 'opencode')
    } catch {
      // A session iso-trace cannot parse yet is skipped.
    }
  }

  return count
}
