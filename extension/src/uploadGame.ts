import * as path from "node:path";
import * as vscode from "vscode";
import {
  DEVELOPMENT_UPLOAD_BASE_URL,
  PRODUCTION_UPLOAD_BASE_URL,
  readGameIDEManifest,
  readPackageJsonBasics,
  uploadGame as uploadGameWithCLI,
  type GameIDEManifest,
} from "gameide-cli";

function getUploadBaseURL(context: vscode.ExtensionContext): string {
  return context.extensionMode === vscode.ExtensionMode.Development
    ? DEVELOPMENT_UPLOAD_BASE_URL
    : PRODUCTION_UPLOAD_BASE_URL;
}

type FirstUploadManifestFields = {
  name: string;
  description: string;
  version: string;
};

async function promptUploadManifestFields(
  projectRoot: string,
  manifest?: GameIDEManifest,
): Promise<FirstUploadManifestFields | undefined> {
  const pkg = await readPackageJsonBasics(projectRoot);
  const version =
    manifest?.version?.trim() || pkg.version?.trim() || "0.0.0";

  const nameFromManifest =
    typeof manifest?.name === "string" ? manifest.name.trim() : "";
  const nameFromPkg = pkg.name?.trim() || "";
  let name = nameFromManifest || nameFromPkg;
  if (!name) {
    const input = await vscode.window.showInputBox({
      title: "Game metadata",
      prompt: "Display name for this game (saved to gameide.json)",
      placeHolder: "e.g. Space Trader",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) return "Name is required";
        return undefined;
      },
    });
    if (input === undefined) return undefined;
    name = input.trim();
    if (!name) return undefined;
  }

  const description =
    (typeof manifest?.description === "string"
      ? manifest.description.trim()
      : "") ||
    pkg.description?.trim() ||
    "";

  return { name, description, version };
}

async function getProjectDirectory(
  resource?: vscode.Uri,
): Promise<vscode.Uri | undefined> {
  if (resource) {
    try {
      const stat = await vscode.workspace.fs.stat(resource);
      if (stat.type & vscode.FileType.Directory) {
        return resource;
      }
      return vscode.Uri.file(path.dirname(resource.fsPath));
    } catch {
      return vscode.Uri.file(path.dirname(resource.fsPath));
    }
  }

  const activeEditorURI = vscode.window.activeTextEditor?.document.uri;
  if (activeEditorURI) {
    const activeWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditorURI);
    if (activeWorkspaceFolder) {
      return activeWorkspaceFolder.uri;
    }
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri;
  }

  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: "Select Game Project",
    title: "Choose project folder (must contain package.json; gameide.json optional for GameIDE)",
  });
  return selected?.[0];
}

async function uploadGame(
  context: vscode.ExtensionContext,
  resource?: vscode.Uri,
): Promise<void> {
  const baseURL = getUploadBaseURL(context);
  const projectDirectory = await getProjectDirectory(resource);
  if (!projectDirectory) return;

  const projectRoot = projectDirectory.fsPath;
  const manifest = await readGameIDEManifest(projectRoot);
  const manifestGameId = manifest?.id?.trim() ?? "";
  const manifestFields = manifestGameId
    ? undefined
    : await promptUploadManifestFields(projectRoot, manifest);

  if (!manifestGameId && manifestFields === undefined) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "GameIDE upload",
      cancellable: false,
    },
    async (progress) => {
      const result = await uploadGameWithCLI({
        projectRoot,
        baseUrl: baseURL,
        manifestFields,
        onProgress: (message) => progress.report({ message }),
      });

      vscode.window.showInformationMessage(
        `Uploaded ${result.uploadedFiles} files to game ${result.gameId} (${result.baseUrl}).`,
      );
    },
  );
}

export function registerUploadGameCommand(
  context: vscode.ExtensionContext,
): void {
  const disposable = vscode.commands.registerCommand(
    "gameide.uploadGame",
    (resource?: vscode.Uri) => uploadGame(context, resource),
  );
  context.subscriptions.push(disposable);
}
