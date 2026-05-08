import type { Plugin } from "vite";
import fs from "node:fs";
import { attachRoomWebSocket } from "./roomWebSocket";

type JSONPrimitive = string | number | boolean | null;
type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

const lifecycleExports = new Set([
  "start",
  "update",
  "gameStart",
  "gameUpdate",
  "editorStart",
  "editorUpdate",
]);

const transformableModulePattern = /\.[cm]?[jt]sx?$/;

function parseSceneJSON(raw: string): JSONValue {
  return JSON.parse(raw) as JSONValue;
}

function createSceneModuleCode(data: JSONValue): string {
  return `const data = ${JSON.stringify(data)};
export default data;
`;
}

function getCleanId(id: string): string {
  return id.replace(/\?.*$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImportedLifecycleNames(code: string): string[] {
  const names = new Set<string>();
  const importPattern = /import\s*\{([\s\S]*?)\}\s*from\s*["']gameide["']/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(code))) {
    const specifiers = match[1]?.split(",") ?? [];
    for (const specifier of specifiers) {
      const normalized = specifier.trim().replace(/^type\s+/, "");
      const imported = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(
        normalized,
      );
      if (!imported) continue;

      const importedName = imported[1];
      const localName = imported[2] ?? importedName;
      if (lifecycleExports.has(importedName)) {
        names.add(localName);
      }
    }
  }

  return [...names];
}

function callsImportedLifecycle(code: string, importedNames: readonly string[]): boolean {
  return importedNames.some((name) => {
    const pattern = new RegExp(`(^|[^\\w$.])${escapeRegExp(name)}\\s*\\(`, "m");
    return pattern.test(code);
  });
}

function shouldTransformHotModule(code: string, id: string): boolean {
  const cleanId = getCleanId(id);
  if (!transformableModulePattern.test(cleanId)) return false;
  if (cleanId.includes("/node_modules/")) return false;
  if (code.includes("__beginHotModule")) return false;

  const importedNames = getImportedLifecycleNames(code);
  return importedNames.length > 0 && callsImportedLifecycle(code, importedNames);
}

function createHotModuleCode(code: string): string {
  return `import { __beginHotModule, __endHotModule, __disposeHotModule, __runHotModuleReplay, getGameContext } from "gameide";
const __gameideHotScope = __beginHotModule(import.meta.url);
${code}
__endHotModule(__gameideHotScope);
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const replay = mod?.default;
    if (typeof replay !== "function") return;
    __runHotModuleReplay(__gameideHotScope, () => replay(getGameContext()));
  });
  import.meta.hot.dispose(() => __disposeHotModule(__gameideHotScope));
}
`;
}

export function gameidePlugin(): Plugin {
  let isServe = false;

  return {
    name: "gameide-plugin",
    configResolved(config) {
      isServe = config.command === "serve";
    },
    configureServer(server) {
      return () => {
        if (server.httpServer) {
          attachRoomWebSocket(server.httpServer);
        }
      };
    },
    load(id: string) {
      const cleanId = getCleanId(id);
      if (!cleanId.endsWith(".scene")) return;

      const raw = fs.readFileSync(cleanId, "utf8");
      const data = parseSceneJSON(raw);
      return createSceneModuleCode(data);
    },
    transform(code, id) {
      if (!isServe || !shouldTransformHotModule(code, id)) return;

      return {
        code: createHotModuleCode(code),
        map: null,
      };
    },
  };
}
