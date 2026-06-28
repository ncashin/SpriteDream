import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { listProjectFiles } from "./virtualCatalog";

const FILES_API = "/gameide/files";

type FileRoute = "list" | "read" | "write";

function isSafeRelativePath(
  projectRoot: string,
  relativePath: string,
): boolean {
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`)) {
    return false;
  }
  const absolute = path.join(projectRoot, normalized);
  const rel = path.relative(projectRoot, absolute);
  return rel !== "" && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function fileContentToWrite(content: unknown): string {
  if (typeof content === "string") return content;
  return `${JSON.stringify(content, null, 2)}\n`;
}

function resolveFileRoute(method: string | undefined, url: URL): FileRoute | null {
  if (url.pathname !== FILES_API) return null;
  switch (method) {
    case "GET":
      return url.searchParams.get("path") === null ? "list" : "read";
    case "POST":
      return "write";
    default:
      return null;
  }
}

function handleListFiles(res: ServerResponse, projectRoot: string): void {
  try {
    sendJSON(res, 200, { files: listProjectFiles(projectRoot) });
  } catch {
    res.statusCode = 500;
    res.end("failed to list files");
  }
}

function handleGetFileContent(
  res: ServerResponse,
  projectRoot: string,
  relativePath: string,
): void {
  if (!isSafeRelativePath(projectRoot, relativePath)) {
    res.statusCode = 400;
    res.end("invalid file path");
    return;
  }

  const absolute = path.join(projectRoot, path.normalize(relativePath));
  try {
    const content = fs.readFileSync(absolute, "utf8");
    sendJSON(res, 200, { path: path.normalize(relativePath), content });
  } catch {
    res.statusCode = 404;
    res.end("file not found");
  }
}

async function handleWriteFile(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  onFileWritten?: (relativePath: string) => void,
): Promise<void> {
  try {
    const body = await readBody(req);
    const payload = JSON.parse(body) as { path?: unknown; content?: unknown };
    if (typeof payload.path !== "string" || payload.content === undefined) {
      res.statusCode = 400;
      res.end("invalid payload");
      return;
    }

    if (!isSafeRelativePath(projectRoot, payload.path)) {
      res.statusCode = 400;
      res.end("invalid file path");
      return;
    }

    const absolute = path.join(projectRoot, path.normalize(payload.path));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(
      absolute,
      fileContentToWrite(payload.content),
      "utf8",
    );
    onFileWritten?.(path.normalize(payload.path));
    res.statusCode = 204;
    res.end();
  } catch {
    res.statusCode = 500;
    res.end("failed to write file");
  }
}

export function attachFileEditorMiddleware(
  server: ViteDevServer,
  projectRoot: string,
  onFileWritten?: (relativePath: string) => void,
): void {
  server.middlewares.use((req, res, next) => {
    const hostHeader = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${hostHeader}`);
    const route = resolveFileRoute(req.method, url);
    if (route === null) {
      next();
      return;
    }

    switch (route) {
      case "list":
        handleListFiles(res, projectRoot);
        return;
      case "read":
        handleGetFileContent(res, projectRoot, url.searchParams.get("path") ?? "");
        return;
      case "write":
        void handleWriteFile(req, res, projectRoot, onFileWritten);
        return;
    }
  });
}
