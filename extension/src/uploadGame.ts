import * as path from "path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";

const DEFAULT_WEBAPP_BASE_URL = "http://localhost:5173";

type BundleUploadFile = {
  path: string;
  contentBase64: string;
};

async function runNPMBuild(cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stderr = "";

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.trim() || `npm run build failed with exit code ${String(code)}`
        )
      );
    });
  });
}

async function collectBundleFiles(
  root: vscode.Uri,
  current: vscode.Uri = root
): Promise<BundleUploadFile[]> {
  const entries = await vscode.workspace.fs.readDirectory(current);
  const files: BundleUploadFile[] = [];

  for (const [name, type] of entries) {
    const uri = vscode.Uri.joinPath(current, name);
    if (type & vscode.FileType.Directory) {
      const nested = await collectBundleFiles(root, uri);
      files.push(...nested);
      continue;
    }
    if (!(type & vscode.FileType.File)) {
      continue;
    }

    const relativePath = path
      .relative(root.fsPath, uri.fsPath)
      .split(path.sep)
      .join("/");
    const content = await vscode.workspace.fs.readFile(uri);
    files.push({
      path: relativePath,
      contentBase64: Buffer.from(content).toString("base64"),
    });
  }

  return files;
}

async function getProjectDirectory(
  resource?: vscode.Uri
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
    title: "Choose project folder (must contain package.json)",
  });
  return selected?.[0];
}

async function uploadGame(resource?: vscode.Uri): Promise<void> {
  const projectDirectory = await getProjectDirectory(resource);
  if (!projectDirectory) {
    return;
  }

  const gameId = await vscode.window.showInputBox({
    title: "Upload Game Bundle",
    prompt: "Game ID to upload bundle to",
    placeHolder: "e.g. 2ab4a33f-6acd-4fd2-b71f-3cd9f81f69f1",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return "Game ID is required";
      }
      return undefined;
    },
  });
  if (gameId === undefined) {
    return;
  }
  const trimmedGameId = gameId.trim();
  if (!trimmedGameId) {
    vscode.window.showErrorMessage("Upload cancelled: Game ID is required.");
    return;
  }

  const webappBaseUrl = await vscode.window.showInputBox({
    title: "Upload Game Bundle",
    prompt: "Webapp base URL",
    value: DEFAULT_WEBAPP_BASE_URL,
    placeHolder: DEFAULT_WEBAPP_BASE_URL,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return "Webapp base URL is required";
      try {
        new URL(trimmed);
        return undefined;
      } catch {
        return "Enter a valid URL";
      }
    },
  });
  if (!webappBaseUrl) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "GameIDE uploadGame",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Running npm run build..." });
      await runNPMBuild(projectDirectory.fsPath);

      const distDirectory = vscode.Uri.joinPath(projectDirectory, "dist");
      try {
        await vscode.workspace.fs.stat(distDirectory);
      } catch {
        throw new Error("Build succeeded, but no dist folder was found.");
      }

      progress.report({ message: "Collecting dist bundle files..." });
      const files = await collectBundleFiles(distDirectory);
      if (files.length === 0) {
        throw new Error("dist folder is empty, nothing to upload.");
      }

      const endpointPath = `/game/${encodeURIComponent(trimmedGameId)}/bundle`;
      const endpoint = new URL(endpointPath, webappBaseUrl.trim());

      progress.report({ message: "Uploading bundle to webapp..." });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Upload failed (${response.status}): ${body || response.statusText}`
        );
      }

      const successMessage = `Uploaded ${files.length} files to game ${trimmedGameId}.`;
      vscode.window.showInformationMessage(successMessage);
    }
  );
}

export function registerUploadGameCommand(
  context: vscode.ExtensionContext
): void {
  const disposable = vscode.commands.registerCommand(
    "gameide.uploadGame",
    uploadGame
  );
  context.subscriptions.push(disposable);
}
