import * as vscode from "vscode";

const GENERATED_SCENE_DECLARATION_HEADER = `
// This file is generated from the matching .scene file.
// Do not edit directly.

`;

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

function getLegacySceneDeclarationUri(sceneUri: vscode.Uri): vscode.Uri {
  return sceneUri.with({ path: sceneUri.path.replace(/\.scene$/, ".d.scene.ts") });
}

function getSceneDeclarationUri(sceneUri: vscode.Uri): vscode.Uri {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(sceneUri);
  if (!workspaceFolder) return getLegacySceneDeclarationUri(sceneUri);

  const relativeScenePath = vscode.workspace.asRelativePath(sceneUri, false);
  return vscode.Uri.joinPath(
    workspaceFolder.uri,
    ".gameide-types",
    relativeScenePath.replace(/\.scene$/, ".d.scene.ts")
  );
}

function toBytes(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

function getParentUri(uri: vscode.Uri): vscode.Uri {
  const lastSlash = uri.path.lastIndexOf("/");
  return uri.with({ path: uri.path.slice(0, lastSlash) || "/" });
}

export async function syncSceneDeclaration(sceneUri: vscode.Uri): Promise<void> {
  if (!sceneUri.path.endsWith(".scene")) return;

  const bytes = await vscode.workspace.fs.readFile(sceneUri);
  const raw = Buffer.from(bytes).toString("utf8");
  const data = JSON.parse(raw) as unknown;
  const declarationUri = getSceneDeclarationUri(sceneUri);
  const legacyDeclarationUri = getLegacySceneDeclarationUri(sceneUri);
  const nextContent = createSceneDeclarationCode(data);

  let currentContent: string | undefined;
  try {
    const currentBytes = await vscode.workspace.fs.readFile(declarationUri);
    currentContent = Buffer.from(currentBytes).toString("utf8");
  } catch {
    currentContent = undefined;
  }

  if (legacyDeclarationUri.toString() !== declarationUri.toString()) {
    try {
      await vscode.workspace.fs.delete(legacyDeclarationUri);
    } catch {
      // Ignore missing legacy sidecars.
    }
  }

  if (currentContent === nextContent) return;
  await vscode.workspace.fs.createDirectory(getParentUri(declarationUri));
  await vscode.workspace.fs.writeFile(declarationUri, toBytes(nextContent));
}

export async function deleteSceneDeclaration(sceneUri: vscode.Uri): Promise<void> {
  if (!sceneUri.path.endsWith(".scene")) return;

  const declarationUri = getSceneDeclarationUri(sceneUri);
  try {
    await vscode.workspace.fs.delete(declarationUri);
  } catch {
    // Ignore missing sidecars.
  }

  const legacyDeclarationUri = getLegacySceneDeclarationUri(sceneUri);
  if (legacyDeclarationUri.toString() === declarationUri.toString()) return;

  try {
    await vscode.workspace.fs.delete(legacyDeclarationUri);
  } catch {
    // Ignore missing legacy sidecars.
  }
}

export async function syncAllSceneDeclarations(): Promise<void> {
  const sceneUris = await vscode.workspace.findFiles("**/*.scene", "**/node_modules/**");
  await Promise.allSettled(sceneUris.map((sceneUri) => syncSceneDeclaration(sceneUri)));
}
