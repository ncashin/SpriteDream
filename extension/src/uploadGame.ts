import * as path from "path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";

const UPLOAD_BASE_URL = "https://gameide.app";

type BundleUploadFile = {
  path: string;
  contentBase64: string;
};

type GameIDEManifest = {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
};

async function readGameIDEManifest(
  projectRoot: vscode.Uri
): Promise<GameIDEManifest | undefined> {
  const uri = vscode.Uri.joinPath(projectRoot, "gameide.json");
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return parsed as GameIDEManifest;
  } catch {
    return undefined;
  }
}

async function gameIDEJsonFileExists(projectRoot: vscode.Uri): Promise<boolean> {
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

async function promptUploadManifestFields(
  projectRoot: vscode.Uri,
  manifest?: GameIDEManifest
): Promise<FirstUploadManifestFields | undefined> {
  const pkg = await readPackageJsonBasics(projectRoot);
  const version =
    manifest?.version?.trim() || pkg.version?.trim() || "0.0.0";

  const nameFromManifest =
    manifest && typeof manifest.name === "string" ? manifest.name.trim() : "";
  const nameFromPkg = pkg.name?.trim() || "";
  let name = nameFromManifest || nameFromPkg;
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

  let description: string;
  if (manifest && typeof manifest.description === "string") {
    description = manifest.description.trim();
  } else if (typeof pkg.description === "string") {
    description = pkg.description.trim();
  } else {
    description = "";
  }

  return { name, description, version };
}

async function writeGameIDEManifest(
  projectRoot: vscode.Uri,
  gameId: string,
  fields: FirstUploadManifestFields,
  mergeFromExistingFile: boolean
): Promise<void> {
  const uri = vscode.Uri.joinPath(projectRoot, "gameide.json");
  let base: Record<string, unknown> = {};
  if (mergeFromExistingFile) {
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      base = {};
    }
  }
  const reserved = new Set(["id", "name", "version", "description"]);
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (!reserved.has(key)) {
      extra[key] = value;
    }
  }
  const merged = {
    name: fields.name,
    version: fields.version,
    description: fields.description,
    id: gameId,
    ...extra,
  };
  await vscode.workspace.fs.writeFile(
    uri,
    Buffer.from(`${JSON.stringify(merged, null, 2)}\n`, "utf8")
  );
}

async function createGameOnServer(
  baseUrl: string,
  fields: FirstUploadManifestFields
): Promise<string> {
  const endpoint = new URL("/game/create", baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: fields.name,
      description: fields.description || undefined,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Create game failed (${response.status}): ${body || response.statusText}`
    );
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error("Create game succeeded but response was not JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Create game response was not a JSON object.");
  }
  const id = (parsed as { id?: unknown }).id;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Create game response missing id.");
  }
  return id.trim();
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
    title: "Choose project folder (must contain package.json; gameide.json optional for GameIDE)",
  });
  return selected?.[0];
}

async function uploadGame(resource?: vscode.Uri): Promise<void> {
  const projectDirectory = await getProjectDirectory(resource);
  if (!projectDirectory) {
    return;
  }

  const manifest = await readGameIDEManifest(projectDirectory);
  const manifestGameId = manifest?.id?.trim() ?? "";
  const hadGameIDEJson = await gameIDEJsonFileExists(projectDirectory);

  let manifestFieldsForNewGame: FirstUploadManifestFields | undefined;
  if (!manifestGameId) {
    manifestFieldsForNewGame = await promptUploadManifestFields(
      projectDirectory,
      manifest
    );
    if (manifestFieldsForNewGame === undefined) {
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
      let targetGameId = manifestGameId;
      if (!targetGameId) {
        progress.report({ message: "Creating game on GameIDE..." });
        targetGameId = await createGameOnServer(
          UPLOAD_BASE_URL,
          manifestFieldsForNewGame!
        );
        progress.report({ message: "Saving GameIDE manifest..." });
        await writeGameIDEManifest(
          projectDirectory,
          targetGameId,
          manifestFieldsForNewGame!,
          hadGameIDEJson
        );
      }

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

      const endpointPath = `/game/${encodeURIComponent(targetGameId)}/upload`;
      const endpoint = new URL(endpointPath, UPLOAD_BASE_URL);

      progress.report({ message: "Uploading bundle to GameIDE..." });
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

      vscode.window.showInformationMessage(
        `Uploaded ${files.length} files to game ${targetGameId}.`
      );
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
