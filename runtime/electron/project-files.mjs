import { readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const skip = new Set(['node_modules', '.git'])

export function projectDirectory(directory) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) return

  try {
    const folder = realpathSync(directory)
    if (!statSync(folder).isDirectory()) return
    return folder
  } catch {
    return
  }
}

function projectFile(directory, filePath) {
  if (typeof filePath !== 'string' || filePath === '') return

  const target = resolve(directory, filePath)
  let fromRoot = relative(directory, target)
  if (fromRoot.startsWith('..') || fromRoot === '' || fromRoot.split(sep).includes('..')) return

  try {
    const real = realpathSync(target)
    fromRoot = relative(directory, real)
    if (fromRoot.startsWith('..') || fromRoot === '' || fromRoot.split(sep).includes('..')) return
    return real
  } catch {
    return target
  }
}

export function listProjectFiles(directory) {
  const folder = projectDirectory(directory)
  if (!folder) return []

  const files = []

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || skip.has(entry.name)) continue

      const path = resolve(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile()) continue

      files.push(relative(folder, path).split(sep).join('/'))
    }
  }

  try {
    walk(folder)
  } catch {
    return []
  }

  files.sort()
  return files
}

export function readProjectFile(directory, filePath) {
  const folder = projectDirectory(directory)
  if (!folder) return

  const target = projectFile(folder, filePath)
  if (!target) return

  try {
    return readFileSync(target)
  } catch {
    return
  }
}

export function writeProjectFile(directory, filePath, body) {
  const folder = projectDirectory(directory)
  if (!folder || !(body instanceof Uint8Array)) return false

  const target = projectFile(folder, filePath)
  if (!target) return false

  const temporary = `${target}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, body)
    renameSync(temporary, target)
    return true
  } catch {
    try {
      unlinkSync(temporary)
    } catch {
      // The temp file was never created.
    }
    return false
  }
}
