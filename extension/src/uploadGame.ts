import * as path from "path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";

/** Production webapp; bundle upload always targets this host. */
const UPLOAD_BASE_URL = "https://gameide.app";

type BundleUploadFile = {
  path: string;
  contentBase64: string;
};

type GameideManifest = {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
};

async function readGameideManifest(
  projectRoot: vscode.Uri
): Promise<GameideManifest | undefined> {
  const uri = vscode.Uri.joinPath(projectRoot, "gameide.json");
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return parsed as GameideManifest;
  } catch {
    return undefined;
  }
}

async function gameideJsonFileExists(projectRoot: vscode.Uri): Promise<boolean> {
  const uri = vscode.Uri.joinPath(projectRoot, "gameide.json");
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

type PackageJsonBasics = {
  name?: string;
  version?: string;
  description?: string;
};

type FirstUploadManifestFields = {
  name: string;
  description: string;
  version: string;
};

async function readPackageJsonBasics(
  projectRoot: vscode.Uri
): Promise<PackageJsonBasics> {
  const uri = vscode.Uri.joinPath(projectRoot, "package.json");
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const o = parsed as Record<string, unknown>;
    return {
      name: typeof o.name === "string" ? o.name : undefined,
      version: typeof o.version === "string" ? o.version : undefined,
      description: typeof o.description === "string" ? o.description : undefined,
    };
  } catch {
    return {};
  }
}

async function promptFirstUploadManifestFields(
  projectRoot: vscode.Uri
): Promise<FirstUploadManifestFields | undefined> {
  const pkg = await readPackageJsonBasics(projectRoot);
  const version = pkg.version?.trim() || "0.0.0";

  let name = pkg.name?.trim() ?? "";
  if (!name) {
    const input = await vscode.window.showInputBox({
      title: "Game metadata",
      prompt: "Display name for this game (saved to gameide.json)",
      placeHolder: "e.g. Space Trader",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) {
          return "Name is required";
        }
        return undefined;
      },
    });
    if (input === undefined) {
      return undefined;
    }
    name = input.trim();
    if (!name) {
      return undefined;
    }
  }

  let description = pkg.description?.trim() ?? "";
  if (!description) {
    const input = await vscode.window.showInputBox({
      title: "Game metadata",
      prompt: "Short description for this game (saved to gameide.json)",
      placeHolder: "Optional — press Enter to leave blank",
      ignoreFocusOut: true,
    });
    if (input === undefined) {
      return undefined;
    }
    description = input.trim();
  }

  return { name, description, version };
}

async function writeInitialGameideJson(
  projectRoot: vscode.Uri,
  gameId: string,
  fields: FirstUploadManifestFields
): Promise<void> {
  const manifest = {
    name: fields.name,
    version: fields.version,
    description: fields.description,
    id: gameId,
  };
  const uri = vscode.Uri.joinPath(projectRoot, "gameide.json");
  await vscode.workspace.fs.writeFile(
    uri,
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  );
}

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
    title: "Choose project folder (must contain package.json; gameide.json optional)",
  });
  return selected?.[0];
}

async function uploadGame(resource?: vscode.Uri): Promise<void> {
  const projectDirectory = await getProjectDirectory(resource);
  if (!projectDirectory) {
    return;
  }

  const manifest = await readGameideManifest(projectDirectory);
  const defaultGameId = manifest?.id?.trim() ?? "";
  const hadGameideJson = await gameideJsonFileExists(projectDirectory);

  const gameId = await vscode.window.showInputBox({
    title: "Upload Game Bundle",
    prompt: "Game ID to upload bundle to",
    placeHolder: "e.g. 2ab4a33f-6acd-4fd2-b71f-3cd9f81f69f1",
    value: defaultGameId,
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

  let manifestFieldsForInitialFile: FirstUploadManifestFields | undefined;
  if (!hadGameideJson) {
    manifestFieldsForInitialFile = await promptFirstUploadManifestFields(
      projectDirectory
    );
    if (manifestFieldsForInitialFile === undefined) {
      return;
    }
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

      const endpointPath = `/game/${encodeURIComponent(trimmedGameId)}/upload`;
      const endpoint = new URL(endpointPath, UPLOAD_BASE_URL);

      progress.report({ message: "Uploading bundle to gameide.app..." });
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

      const baseSuccessMessage = `Uploaded ${files.length} files to game ${trimmedGameId}.`;
      if (!hadGameideJson) {
        try {
          progress.report({ message: "Creating gameide.json..." });
          await writeInitialGameideJson(
            projectDirectory,
            trimmedGameId,
            manifestFieldsForInitialFile!
          );
          vscode.window.showInformationMessage(
            `${baseSuccessMessage} Created gameide.json.`
          );
        } catch (err) {
          vscode.window.showWarningMessage(
            `${baseSuccessMessage} Could not write gameide.json: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        return;
      }
      vscode.window.showInformationMessage(baseSuccessMessage);
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
