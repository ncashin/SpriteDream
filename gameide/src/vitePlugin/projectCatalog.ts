import fs from "node:fs";
import path from "node:path";

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".git"]);

function isSkippedDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || name.startsWith(".");
}

function toPosixRelative(base: string, absolutePath: string): string {
  return path.relative(base, absolutePath).split(path.sep).join("/");
}

function walkFiles(
  dir: string,
  filter: (absolutePath: string) => boolean,
): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (isSkippedDir(entry.name)) continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(absolutePath, filter));
    } else if (entry.isFile() && filter(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
}

/** Project `public/assets` or top-level `assets` (template layout). */
export function resolveAssetsDir(projectRoot: string): string | null {
  for (const relative of ["public/assets", "assets"]) {
    const dir = path.join(projectRoot, relative);
    try {
      if (fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Paths relative to the assets folder (e.g. `vite.svg`). */
export function listProjectAssets(projectRoot: string): string[] {
  const assetsDir = resolveAssetsDir(projectRoot);
  if (!assetsDir) return [];

  const files = walkFiles(assetsDir, () => true);
  return files
    .map((file) => toPosixRelative(assetsDir, file))
    .sort((a, b) => a.localeCompare(b));
}

/** Paths relative to the project root (e.g. `source/scenes/foo.scene`). */
export function listProjectScenes(projectRoot: string): string[] {
  const files = walkFiles(projectRoot, (file) => file.endsWith(".scene"));
  return files
    .map((file) => toPosixRelative(projectRoot, file))
    .sort((a, b) => a.localeCompare(b));
}

export function catalogFileAffectsAssets(
  projectRoot: string,
  file: string,
): boolean {
  const assetsDir = resolveAssetsDir(projectRoot);
  if (!assetsDir) return false;
  const normalized = path.normalize(file);
  return (
    normalized === assetsDir || normalized.startsWith(assetsDir + path.sep)
  );
}

export function catalogFileAffectsScenes(file: string): boolean {
  return file.endsWith(".scene");
}
