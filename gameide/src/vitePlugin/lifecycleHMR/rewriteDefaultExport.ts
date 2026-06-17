import ts from "typescript";
import { createModuleSourceFile } from "./detectLifecycleHooks";

export function wrapHMRDefaultExport(code: string, id: string): string | null {
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
