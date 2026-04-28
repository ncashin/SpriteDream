import type { Plugin, ResolvedConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { GameIDEMetadata } from "../meta/gameideManifestTypes.js";

const MANIFEST_VIRTUAL = "\0virtual:gameide-manifest";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function readManifestData(root: string): GameIDEMetadata {
  const manifestPath = path.join(root, "gameide.json");
  if (!fs.existsSync(manifestPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    return JSON.parse(raw) as GameIDEMetadata;
  } catch {
    return {};
  }
}

function loadManifestModuleSource(root: string): string {
  const data = readManifestData(root);
  return `export default ${JSON.stringify(data)};\n`;
}

function parseSceneJson(raw: string): JsonValue {
  return JSON.parse(raw) as JsonValue;
}

function createSceneModuleCode(data: JsonValue): string {
  return `const data = ${JSON.stringify(data)};
export default data;
`;
}

export function gameidePlugin(): Plugin {
  let config: ResolvedConfig | undefined;

  return {
    name: "gameide-plugin",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      const manifestPath = path.join(server.config.root, "gameide.json");
      server.watcher.add(manifestPath);

      server.watcher.on("change", (changedPath: string) => {
        if (path.normalize(changedPath) === path.normalize(manifestPath)) {
          const mod = server.moduleGraph.getModuleById(MANIFEST_VIRTUAL);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      });
    },
    resolveId(id: string) {
      if (id === "virtual:gameide-manifest") {
        return MANIFEST_VIRTUAL;
      }
      return;
    },
    load(id: string) {
      if (id === MANIFEST_VIRTUAL) {
        const root = config?.root;
        if (!root) {
          return "export default {};\n";
        }
        return loadManifestModuleSource(root);
      }

      const cleanId = id.replace(/\?.*$/, "");
      if (!cleanId.endsWith(".scene")) return;

      const raw = fs.readFileSync(cleanId, "utf8");
      const data = parseSceneJson(raw);
      return createSceneModuleCode(data);
    },
  };
}
