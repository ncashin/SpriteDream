import type { Plugin, ViteDevServer } from "vite";
import fs from "node:fs";
import ts from "typescript";
import { attachRoomWebSocket } from "./roomWebSocket";
import hotModuleTemplate from "./hotModuleTemplate.js?raw";
import {
  stripScenePatchSentinels,
  type SceneObject,
} from "../scene/scene.js";

function createSceneModuleCode(data: SceneObject): string {
  return `const data = ${JSON.stringify(data)};\nexport default data;\n`;
}

const lifecycleExports = new Set([
  "start",
  "update",
  "onGameStart",
  "onGameUpdate",
  "onEditorStart",
  "onEditorUpdate",
]);

const transformableModulePattern = /\.[cm]?[jt]sx?$/;

function createModuleSourceFile(code: string, filePath: string): ts.SourceFile {
  const scriptKind = /\.tsx$/i.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, scriptKind);
}

/** True when the module imports a lifecycle hook from `gameide` and calls it. */
function moduleUsesGameideLifecycle(code: string, filePath: string): boolean {
  const sourceFile = createModuleSourceFile(code, filePath);
  const lifecycleLocals = new Set<string>();

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) {
      continue;
    }
    if (stmt.moduleSpecifier.text !== "gameide") continue;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const spec of bindings.elements) {
      if (spec.isTypeOnly) continue;
      const imported = (spec.propertyName ?? spec.name).text;
      if (lifecycleExports.has(imported)) {
        lifecycleLocals.add(spec.name.text);
      }
    }
  }

  if (lifecycleLocals.size === 0) return false;

  return (
    ts.forEachChild(sourceFile, function visit(node): boolean | undefined {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        lifecycleLocals.has(node.expression.text)
      ) {
        return true;
      }
      return ts.forEachChild(node, visit);
    }) === true
  );
}

/**
 * Wraps `export default` so the last invocation's arguments are persisted for HMR replay
 * (same arity and values as the app entry called, not hard-coded `getGameContext()`).
 */
function wrapHMRDefaultExport(code: string, id: string): string | null {
  const filePath = id.replace(/\?.*$/, "");
  const sourceFile = createModuleSourceFile(code, filePath);

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

const hotModuleBodyPlaceholder = "__GAMEIDE_HOT_MODULE_BODY__";

function createHotModuleCode(code: string): string {
  return hotModuleTemplate.replace(hotModuleBodyPlaceholder, code);
}

import {
  catalogFileAffects,
  invalidateCatalogModules,
  listProjectAssets,
  listProjectScenes,
  resolvedVirtualModuleId,
  VIRTUAL_ASSETS_MODULE,
  VIRTUAL_SCENES_MODULE,
} from "./virtualCatalog";
import { attachFileEditorMiddleware } from "./fileEditor";

function createCatalogModuleCode(values: readonly string[]): string {
  return `export default ${JSON.stringify(values)};\n`;
}

export function gameidePlugin(): Plugin {
  let isServe = false;
  let projectRoot = process.cwd();

  return {
    name: "gameide-plugin",
    enforce: "post",
    configResolved(config) {
      isServe = config.command === "serve";
      projectRoot = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ASSETS_MODULE || id === VIRTUAL_SCENES_MODULE) {
        return resolvedVirtualModuleId(id);
      }
    },
    configureServer(server) {
      return () => {
        attachFileEditorMiddleware(server, projectRoot);
        if (server.httpServer) {
          attachRoomWebSocket(server.httpServer);
        }
      };
    },
    handleHotUpdate({ file, server }) {
      if (catalogFileAffects(projectRoot, file)) {
        invalidateCatalogModules(server);
      }
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId(VIRTUAL_ASSETS_MODULE)) {
        return createCatalogModuleCode(listProjectAssets(projectRoot));
      }
      if (id === resolvedVirtualModuleId(VIRTUAL_SCENES_MODULE)) {
        return createCatalogModuleCode(listProjectScenes(projectRoot));
      }

      const filePath = id.replace(/\?.*$/, "");
      if (!filePath.endsWith(".scene")) return;

      const raw = fs.readFileSync(filePath, "utf8");
      const data = stripScenePatchSentinels(JSON.parse(raw) as SceneObject);
      return createSceneModuleCode(data);
    },
    transform(code, id) {
      if (!isServe) return;
      const filePath = id.replace(/\?.*$/, "");
      if (!transformableModulePattern.test(filePath)) return;
      if (filePath.includes("/node_modules/")) return;
      if (code.includes("__beginHotModule")) return;
      if (!moduleUsesGameideLifecycle(code, filePath)) return;

      const wrappedDefault = wrapHMRDefaultExport(code, id);

      return {
        code: createHotModuleCode(wrappedDefault ?? code),
        map: null,
      };
    },
  };
}
