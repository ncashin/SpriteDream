import fs from "node:fs";
import path from "node:path";
import type { ViteDevServer } from "vite";

export const VIRTUAL_ASSETS_MODULE = "gameide:assets";
export const VIRTUAL_SCENES_MODULE = "gameide:scenes";

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".git"]);

const virtualModulePrefix = "\0";

const virtualModuleInternalId: Record<string, string> = {
  [VIRTUAL_ASSETS_MODULE]: "gameide-assets",
  [VIRTUAL_SCENES_MODULE]: "gameide-scenes",
};

export function resolvedVirtualModuleId(publicId: string): string {
  const internal = virtualModuleInternalId[publicId] ?? publicId;
  return virtualModulePrefix + internal;
}

export function invalidateCatalogModules(server: ViteDevServer): void {
  for (const virtualId of [VIRTUAL_ASSETS_MODULE, VIRTUAL_SCENES_MODULE]) {
    const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId(virtualId));
    if (mod) server.moduleGraph.invalidateModule(mod);
  }
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
    const dirName = entry.name;
    if (SKIP_DIR_NAMES.has(dirName) || dirName.startsWith(".")) continue;
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

export function listProjectAssets(projectRoot: string): string[] {
  const assetsDir = resolveAssetsDir(projectRoot);
  if (!assetsDir) return [];

  const files = walkFiles(assetsDir, () => true);
  return files
    .map((file) => toPosixRelative(assetsDir, file))
    .sort((a, b) => a.localeCompare(b));
}

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
