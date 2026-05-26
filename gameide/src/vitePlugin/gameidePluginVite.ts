import type { Plugin } from "vite";
import fs from "node:fs";
import ts from "typescript";
import { attachRoomWebSocket } from "./roomWebSocket";

type JSONPrimitive = string | number | boolean | null;
type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

const lifecycleExports = new Set([
  "start",
  "update",
  "onGameStart",
  "onGameUpdate",
  "onEditorStart",
  "onEditorUpdate",
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

/**
 * Wraps `export default` so the last invocation's arguments are persisted for HMR replay
 * (same arity and values as the app entry called, not hard-coded `getGameContext()`).
 */
function wrapGameideHotDefaultExport(code: string, id: string): string | null {
  const cleanId = getCleanId(id);
  const scriptKind = /\.tsx$/i.test(cleanId) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    cleanId,
    code,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const newStatements: ts.Statement[] = [];
  let rewroteDefault = false;

  for (const stmt of sourceFile.statements) {
    if (
      ts.isClassDeclaration(stmt) &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      return null;
    }

    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      rewroteDefault = true;
      const filteredMods = stmt.modifiers!.filter(
        (m) =>
          m.kind !== ts.SyntaxKind.ExportKeyword &&
          m.kind !== ts.SyntaxKind.DefaultKeyword,
      );
      const name =
        stmt.name ??
        ts.factory.createIdentifier(`__gameideAnonymousDefault_${stmt.pos}`);
      const decl = ts.factory.updateFunctionDeclaration(
        stmt,
        filteredMods,
        stmt.asteriskToken,
        name,
        stmt.typeParameters,
        stmt.parameters,
        stmt.type,
        stmt.body,
      );
      const exportDefault = ts.factory.createExportAssignment(
        undefined,
        false,
        ts.factory.createCallExpression(
          ts.factory.createIdentifier("__hotModuleDefaultExport"),
          undefined,
          [
            ts.factory.createIdentifier("__gameideHotScope"),
            ts.factory.createIdentifier("__gameideHotLastArgs"),
            name,
          ],
        ),
      );
      newStatements.push(decl, exportDefault);
      continue;
    }

    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      rewroteDefault = true;
      newStatements.push(
        ts.factory.createExportAssignment(
          undefined,
          false,
          ts.factory.createCallExpression(
            ts.factory.createIdentifier("__hotModuleDefaultExport"),
            undefined,
            [
              ts.factory.createIdentifier("__gameideHotScope"),
              ts.factory.createIdentifier("__gameideHotLastArgs"),
              stmt.expression,
            ],
          ),
        ),
      );
      continue;
    }

    newStatements.push(stmt);
  }

  if (!rewroteDefault) return null;

  const newSourceFile = ts.factory.updateSourceFile(sourceFile, newStatements);
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  return printer.printFile(newSourceFile);
}

function createHotModuleCode(code: string): string {
  return `import { __beginHotModule, __endHotModule, __disposeHotModule, __runHotModuleReplay, __hotModuleDefaultExport, __hotModuleLastArgsForScope, getGameContext } from "gameide";
const __gameideHotScope = __beginHotModule(import.meta.url);
const __gameideHotLastArgs = __hotModuleLastArgsForScope(__gameideHotScope);
${code}
__endHotModule(__gameideHotScope);
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const replay = mod?.default;
    if (typeof replay !== "function") return;
    const args =
      __gameideHotLastArgs.kind === "called"
        ? __gameideHotLastArgs.args
        : [getGameContext()];
    __runHotModuleReplay(__gameideHotScope, () => replay.apply(undefined, args));
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

      const wrappedDefault = wrapGameideHotDefaultExport(code, id);

      return {
        code: createHotModuleCode(wrappedDefault ?? code),
        map: null,
      };
    },
  };
}
