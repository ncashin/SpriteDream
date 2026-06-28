import ts from "typescript";

export const lifecycleExports = new Set([
  "onStart",
  "onUpdate",
  "onGameStart",
  "onGameUpdate",
  "onEditorStart",
  "onEditorUpdate",
]);

export function createModuleSourceFile(code: string, filePath: string): ts.SourceFile {
  const scriptKind = /\.tsx$/i.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, scriptKind);
}

export function detectLifecycleHooks(code: string, filePath: string): boolean {
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
