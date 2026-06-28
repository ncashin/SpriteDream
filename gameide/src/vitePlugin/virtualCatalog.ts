import fs from "node:fs";
import path from "node:path";
import type { ViteDevServer } from "vite";

export const VIRTUAL_ASSETS_MODULE = "gameide:assets";

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".git"]);

export function resolvedVirtualModuleId(publicId: string): string {
  const internal = publicId === VIRTUAL_ASSETS_MODULE ? "gameide-assets" : publicId;
  return "\0" + internal;
}

export function invalidateCatalogModules(server: ViteDevServer): void {
  const mod = server.moduleGraph.getModuleById(
    resolvedVirtualModuleId(VIRTUAL_ASSETS_MODULE),
  );
  if (mod) server.moduleGraph.invalidateModule(mod);
}

export function toPosixRelative(base: string, absolutePath: string): string {
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

export function resolveAssetsDir(projectRoot: string): string | null {
  const dir = path.join(projectRoot, "public");
  try {
    if (fs.statSync(dir).isDirectory()) return dir;
  } catch {}
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

export function listProjectFiles(projectRoot: string): string[] {
  const files = walkFiles(projectRoot, () => true);
  return files
    .map((file) => toPosixRelative(projectRoot, file))
    .sort((a, b) => a.localeCompare(b));
}

export function createCatalogModuleCode(projectRoot: string): string {
  return `export default ${JSON.stringify({
    assets: listProjectAssets(projectRoot),
    scenes: listProjectScenes(projectRoot),
  })};\n`;
}

export function loadCatalogModule(
  id: string,
  projectRoot: string,
): string | undefined {
  if (id !== resolvedVirtualModuleId(VIRTUAL_ASSETS_MODULE)) return;
  return createCatalogModuleCode(projectRoot);
}

export function catalogFileAffects(
  projectRoot: string,
  file: string,
  knownScenes: readonly string[],
): boolean {
  const normalized = path.normalize(file);
  if (normalized.endsWith(".scene")) {
    try {
      fs.statSync(normalized);
      return !knownScenes.includes(toPosixRelative(projectRoot, normalized));
    } catch {
      return true;
    }
  }

  const assetsDir = resolveAssetsDir(projectRoot);
  if (!assetsDir) return false;

  const assetsPath = path.normalize(assetsDir);
  return normalized === assetsPath || normalized.startsWith(assetsPath + path.sep);
}
