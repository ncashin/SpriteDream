import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { templateFiles } from "./templateFiles";

export const PRODUCTION_UPLOAD_BASE_URL = "https://gameide.app";
export const DEVELOPMENT_UPLOAD_BASE_URL = "http://localhost:5173";

export type CreateGameIDEProjectOptions = {
  cwd?: string;
  directory?: string;
  name?: string;
};

export type CreateGameIDEProjectResult = {
  name: string;
  directory: string;
};

export type GameIDEManifest = {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
};

export type UploadGameOptions = {
  projectRoot?: string;
  baseUrl?: string;
  buildCommand?: string;
  distDirectory?: string;
  skipBuild?: boolean;
  manifestFields?: {
    name?: string;
    version?: string;
    description?: string;
  };
  onProgress?: (message: string) => void;
};

export type UploadGameResult = {
  gameId: string;
  uploadedFiles: number;
  baseUrl: string;
};

type PackageJsonBasics = {
  name?: string;
  version?: string;
  description?: string;
};

type ManifestFields = {
  name: string;
  description: string;
  version: string;
};

function toProjectName(rawName: string): string {
  return (
    rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gameide-project"
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectoryIsWritableTarget(targetDirectory: string): Promise<void> {
  if (!(await pathExists(targetDirectory))) {
    await fs.mkdir(targetDirectory, { recursive: true });
    return;
  }

  const entries = await fs.readdir(targetDirectory);
  if (entries.length > 0) {
    throw new Error(
      `Target directory is not empty: ${path.relative(process.cwd(), targetDirectory)}`,
    );
  }
}

async function writeTemplateFiles(
  toDirectory: string,
  replacements: Record<string, string>,
): Promise<void> {
  for (const [relativePath, rawContent] of Object.entries(templateFiles)) {
    const outputPath = path.join(toDirectory, relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    let content = rawContent;
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.split(placeholder).join(value);
    }
    await fs.writeFile(outputPath, content, "utf8");
  }
}

export async function createGameIDEProject(
  options: CreateGameIDEProjectOptions,
): Promise<CreateGameIDEProjectResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const rawName = options.name?.trim() || options.directory?.trim() || "my-gameide-game";
  const projectName = toProjectName(rawName);
  const targetDirectory = path.resolve(cwd, options.directory ?? projectName);

  await ensureDirectoryIsWritableTarget(targetDirectory);
  await writeTemplateFiles(targetDirectory, {
    "gameide-template-project": projectName,
    __GAMEIDE_PROJECT_NAME__: projectName,
    __GAMEIDE_DISPLAY_NAME__: projectName,
  });

  return {
    name: projectName,
    directory: targetDirectory,
  };
}

export async function readGameIDEManifest(
  projectRoot: string,
): Promise<GameIDEManifest | undefined> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "gameide.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as GameIDEManifest)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function readPackageJsonBasics(
  projectRoot: string,
): Promise<PackageJsonBasics> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const pkg = parsed as Record<string, unknown>;
    return {
      name: typeof pkg.name === "string" ? pkg.name : undefined,
      version: typeof pkg.version === "string" ? pkg.version : undefined,
      description:
        typeof pkg.description === "string" ? pkg.description : undefined,
    };
  } catch {
    return {};
  }
}

async function writeGameIDEManifest(
  projectRoot: string,
  gameId: string,
  fields: ManifestFields,
  mergeExisting: boolean,
): Promise<void> {
  const manifestPath = path.join(projectRoot, "gameide.json");
  let base: Record<string, unknown> = {};
  if (mergeExisting) {
    const existing = await readGameIDEManifest(projectRoot);
    if (existing) base = { ...existing };
  }

  const reserved = new Set(["id", "name", "version", "description"]);
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (!reserved.has(key)) extra[key] = value;
  }

  const merged = {
    name: fields.name,
    version: fields.version,
    description: fields.description,
    id: gameId,
    ...extra,
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

async function createGameOnServer(
  baseUrl: string,
  fields: ManifestFields,
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
      `Create game failed (${response.status}): ${body || response.statusText}`,
    );
  }

  const parsed: unknown = await response.json();
  const id = parsed && typeof parsed === "object"
    ? (parsed as { id?: unknown }).id
    : undefined;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Create game response missing id.");
  }
  return id.trim();
}

async function runBuildCommand(cwd: string, command: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stdout?.pipe(process.stdout);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} failed with exit code ${code}`));
    });
  });
}

async function collectBundleFiles(
  root: string,
  current = root,
): Promise<Array<{ path: string; contentBase64: string }>> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: Array<{ path: string; contentBase64: string }> = [];

  for (const entry of entries) {
    const filePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectBundleFiles(root, filePath)));
      continue;
    }
    if (!entry.isFile()) continue;

    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", reject);
      stream.on("end", resolve);
    });
    files.push({
      path: relativePath,
      contentBase64: Buffer.concat(chunks).toString("base64"),
    });
  }

  return files;
}

function buildManifestFields(
  manifest: GameIDEManifest | undefined,
  pkg: PackageJsonBasics,
  overrides: UploadGameOptions["manifestFields"] = {},
): ManifestFields {
  const name =
    overrides.name?.trim() ||
    (typeof manifest?.name === "string" ? manifest.name.trim() : "") ||
    pkg.name?.trim();
  if (!name) {
    throw new Error(
      "No game name found. Add gameide.json, package.json name, or pass --name.",
    );
  }

  return {
    name,
    description:
      overrides.description?.trim() ||
      (typeof manifest?.description === "string" ? manifest.description.trim() : "") ||
      pkg.description?.trim() ||
      "",
    version:
      overrides.version?.trim() ||
      (typeof manifest?.version === "string" ? manifest.version.trim() : "") ||
      pkg.version?.trim() ||
      "0.0.0",
  };
}

export async function uploadGame(options: UploadGameOptions): Promise<UploadGameResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const baseUrl = options.baseUrl ?? PRODUCTION_UPLOAD_BASE_URL;
  const buildCommand = options.buildCommand ?? "npm run build";
  const progress = options.onProgress ?? (() => {});
  const manifest = await readGameIDEManifest(projectRoot);
  const manifestGameId =
    typeof manifest?.id === "string" ? manifest.id.trim() : "";

  let targetGameId = manifestGameId;
  if (!targetGameId) {
    const pkg = await readPackageJsonBasics(projectRoot);
    const fields = buildManifestFields(manifest, pkg, options.manifestFields);
    progress("Creating game on GameIDE...");
    targetGameId = await createGameOnServer(baseUrl, fields);
    progress("Saving GameIDE manifest...");
    await writeGameIDEManifest(projectRoot, targetGameId, fields, Boolean(manifest));
  }

  if (!options.skipBuild) {
    progress(`Running ${buildCommand}...`);
    await runBuildCommand(projectRoot, buildCommand);
  }

  const distDirectory = path.join(projectRoot, options.distDirectory ?? "dist");
  if (!(await pathExists(distDirectory))) {
    throw new Error("Build succeeded, but no dist folder was found.");
  }

  progress("Collecting dist bundle files...");
  const files = await collectBundleFiles(distDirectory);
  if (files.length === 0) {
    throw new Error("dist folder is empty, nothing to upload.");
  }

  const endpoint = new URL(`/game/${encodeURIComponent(targetGameId)}/upload`, baseUrl);
  progress("Uploading bundle to GameIDE...");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upload failed (${response.status}): ${body || response.statusText}`);
  }

  return {
    gameId: targetGameId,
    uploadedFiles: files.length,
    baseUrl,
  };
}
