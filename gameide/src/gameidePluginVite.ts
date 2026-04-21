import type { Plugin, ResolvedConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

const MANIFEST_VIRTUAL = "\0virtual:gameide-manifest";

function loadManifestModuleSource(root: string): string {
  const manifestPath = path.join(root, "gameide.json");
  if (!fs.existsSync(manifestPath)) {
    return "export default {};\n";
  }
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const data = JSON.parse(raw) as unknown;
    return `export default ${JSON.stringify(data)};\n`;
  } catch {
    return "export default {};\n";
  }
}

const GENERATED_SCENE_DECLARATION_HEADER = `
// This file is generated from the matching .scene file.
// Do not edit directly.

`;

function createSceneModuleCode(data: unknown): string {
  return `const data = ${JSON.stringify(data)};
export default data;
`;
}

function isIdentifier(key: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/.test(key);
}

function formatObjectKey(key: string): string {
  return isIdentifier(key) ? key : JSON.stringify(key);
}

function formatLiteralType(value: unknown, depth = 0): string {
  const indent = "  ".repeat(depth);
  const childIndent = "  ".repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return "readonly []";
    return `readonly [\n${value
      .map((item) => `${childIndent}${formatLiteralType(item, depth + 1)}`)
      .join(",\n")}\n${indent}]`;
  }

  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? String(value) : "number";
    case "boolean":
      return value ? "true" : "false";
    case "object": {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return "{}";
      return `{\n${entries
        .map(
          ([key, child]) =>
            `${childIndent}readonly ${formatObjectKey(key)}: ${formatLiteralType(child, depth + 1)};`
        )
        .join("\n")}\n${indent}}`;
    }
    default:
      return "unknown";
  }
}

function createSceneDeclarationCode(data: unknown): string {
  return `${GENERATED_SCENE_DECLARATION_HEADER}declare const data: ${formatLiteralType(data)};
export default data;
`;
}

function getSceneDeclarationPath(scenePath: string, rootDir: string): string {
  const relativeScenePath = path.relative(rootDir, scenePath);
  return path.join(
    rootDir,
    ".gameide-types",
    relativeScenePath.replace(/\.scene$/, ".d.scene.ts")
  );
}

function getLegacySceneDeclarationPath(scenePath: string): string {
  return scenePath.replace(/\.scene$/, ".d.scene.ts");
}

function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeIfChanged(filePath: string, content: string): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : undefined;
  if (existing === content) return;
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, content);
}

function syncSceneDeclaration(scenePath: string, rootDir: string): void {
  if (!scenePath.endsWith(".scene")) return;

  const declarationPath = getSceneDeclarationPath(scenePath, rootDir);
  const legacyDeclarationPath = getLegacySceneDeclarationPath(scenePath);
  if (!fs.existsSync(scenePath)) {
    if (fs.existsSync(declarationPath)) fs.unlinkSync(declarationPath);
    if (fs.existsSync(legacyDeclarationPath)) fs.unlinkSync(legacyDeclarationPath);
    return;
  }

  const raw = fs.readFileSync(scenePath, "utf8");
  const data = JSON.parse(raw) as unknown;
  writeIfChanged(declarationPath, createSceneDeclarationCode(data));
  if (fs.existsSync(legacyDeclarationPath)) fs.unlinkSync(legacyDeclarationPath);
}

function syncSceneDeclarationsInDirectory(scanDir: string, rootDir: string): void {
  if (!fs.existsSync(scanDir)) return;

  for (const entry of fs.readdirSync(scanDir, { withFileTypes: true })) {
    if (
      entry.name === ".gameide-types" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "node_modules"
    ) {
      continue;
    }

    const fullPath = path.join(scanDir, entry.name);
    if (entry.isDirectory()) {
      syncSceneDeclarationsInDirectory(fullPath, rootDir);
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".scene")) {
      syncSceneDeclaration(fullPath, rootDir);
    }
  }
}

function pruneStaleSceneDeclarations(rootDir: string): void {
  const generatedRoot = path.join(rootDir, ".gameide-types");
  if (!fs.existsSync(generatedRoot)) return;

  function walk(dirPath: string): void {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
        continue;
      }

      if (!entry.isFile() || !fullPath.endsWith(".d.scene.ts")) continue;
      const relativeDeclarationPath = path.relative(generatedRoot, fullPath);
      const sourceScenePath = path.join(
        rootDir,
        relativeDeclarationPath.replace(/\.d\.scene\.ts$/, ".scene")
      );
      if (!fs.existsSync(sourceScenePath)) fs.unlinkSync(fullPath);
    }
  }

  walk(generatedRoot);
}

export function gameidePlugin(): Plugin {
  let config: ResolvedConfig | undefined;

  return {
    name: "gameide-plugin",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      syncSceneDeclarationsInDirectory(config.root, config.root);
      pruneStaleSceneDeclarations(config.root);
    },
    configureServer(server) {
      const manifestPath = path.join(server.config.root, "gameide.json");
      server.watcher.add(manifestPath);
      server.watcher.on("change", (changedPath) => {
        if (path.normalize(changedPath) !== path.normalize(manifestPath)) {
          return;
        }
        const mod = server.moduleGraph.getModuleById(MANIFEST_VIRTUAL);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
      });
    },
    buildStart() {
      if (!config) return;
      syncSceneDeclarationsInDirectory(config.root, config.root);
      pruneStaleSceneDeclarations(config.root);
    },
    resolveId(id) {
      if (id === "virtual:gameide-manifest") {
        return MANIFEST_VIRTUAL;
      }
      return;
    },
    load(id) {
      if (id === MANIFEST_VIRTUAL) {
        const root = config?.root;
        if (!root) {
          return "export default {};\n";
        }
        return loadManifestModuleSource(root);
      }
      const cleanId = id.replace(/\?.*$/, "");
      if (!cleanId.endsWith(".scene")) return;
      if (config) syncSceneDeclaration(cleanId, config.root);
      const raw = fs.readFileSync(cleanId, "utf8");
      const data = JSON.parse(raw) as unknown;
      return createSceneModuleCode(data);
    },
    watchChange(id) {
      if (id.endsWith(".scene") && config) {
        syncSceneDeclaration(id, config.root);
      }
    },
  };
}
