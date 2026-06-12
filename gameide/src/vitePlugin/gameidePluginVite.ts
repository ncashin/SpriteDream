import type { Plugin, ViteDevServer } from "vite";
import fs from "node:fs";
import ts from "typescript";
import { attachRoomWebSocket } from "./roomWebSocket";
import hotModuleTemplate from "./hotModuleTemplate.js?raw";
import {
  type SceneObject,
} from "../scene/scene.js";

import {
  catalogFileAffects,
  invalidateCatalogModules,
  listProjectAssets,
  listProjectScenes,
  resolvedVirtualModuleId,
  toPosixRelative,
  VIRTUAL_ASSETS_MODULE,
  VIRTUAL_SCENES_MODULE,
} from "./virtualCatalog";
import { attachFileEditorMiddleware } from "./fileEditor";

export const SCENE_HMR_EVENT = "gameide:scene-hmr";

function createSceneModuleCode(data: SceneObject, relativePath: string): string {
  return (
    `const data = ${JSON.stringify(data)};\n` +
    `export default data;\n` +
    `if (import.meta.hot) import.meta.hot.accept((mod) => {\n` +
    `  window.dispatchEvent(new CustomEvent(${JSON.stringify(SCENE_HMR_EVENT)}, { detail: { path: ${JSON.stringify(relativePath)}, data: mod.default } }));\n` +
    `});\n`
  );
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

function createCatalogModuleCode(values: readonly string[]): string {
  return `export default ${JSON.stringify(values)};\n`;
}

const VIRTUAL_MODULE_PREFIX = /^gameide:/;

export function gameidePlugin(): Plugin {
  let isServe = false;
  let projectRoot = process.cwd();
  let knownScenes: string[] = [];

  return {
    name: "gameide-plugin",
    enforce: "post",
    config() {
      return {
        optimizeDeps: {
          exclude: ["gameide"],
          esbuildOptions: {
            plugins: [
              {
                name: "gameide-virtual-modules",
                setup(build) {
                  build.onResolve({ filter: VIRTUAL_MODULE_PREFIX }, (args) => ({
                    path: args.path,
                    external: true,
                  }));
                },
              },
            ],
          },
        },
      };
    },
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
      knownScenes = listProjectScenes(projectRoot);
      return () => {
        attachFileEditorMiddleware(server, projectRoot, () => {
          invalidateCatalogModules(server);
          knownScenes = listProjectScenes(projectRoot);
        });
        if (server.httpServer) {
          attachRoomWebSocket(server.httpServer);
        }
      };
    },
    handleHotUpdate({ file, server }) {
      if (catalogFileAffects(projectRoot, file, knownScenes)) {
        invalidateCatalogModules(server);
      }
      knownScenes = listProjectScenes(projectRoot);
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

      let raw: string;
      try {
        raw = fs.readFileSync(filePath, "utf8");
      } catch {
        const relativePath = toPosixRelative(projectRoot, filePath);
        return `throw new Error(${JSON.stringify(`Scene not found: ${relativePath}`)});\n`;
      }
      const data = JSON.parse(raw) as SceneObject;
      const relativePath = toPosixRelative(projectRoot, filePath);
      return createSceneModuleCode(data, relativePath);
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
