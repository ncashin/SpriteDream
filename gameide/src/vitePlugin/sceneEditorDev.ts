import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ViteDevServer } from "vite";
import { listProjectScenes } from "./projectCatalog";
export const GAMEIDE_RUNTIME_QUERY = "gameide-runtime";
export const VIRTUAL_SCENE_EDITOR_HOST = "gameide:scene-editor-host";
const SCENE_API_PATH = "/__gameide/scene";
const SCENES_LIST_PATH = "/__gameide/scenes";
const SCENE_EDITOR_SCRIPT_PLACEHOLDER = "{{SCENE_EDITOR_SCRIPT}}";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));

export function sceneEditorHostEntryPath(): string {
  return path.join(pluginDir, "sceneEditorHost.ts");
}

function readSceneEditorPageHtml(): string {
  return fs.readFileSync(
    path.join(pluginDir, "sceneEditorPage.html"),
    "utf8",
  );
}

function isSafeSceneRelativePath(
  projectRoot: string,
  relativePath: string,
): boolean {
  if (!relativePath.endsWith(".scene")) return false;
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`)) {
    return false;
  }
  const absolute = path.join(projectRoot, normalized);
  const rel = path.relative(projectRoot, absolute);
  return rel !== "" && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function resolveSceneAbsolutePath(
  projectRoot: string,
  relativePath: string,
): string | null {
  if (!isSafeSceneRelativePath(projectRoot, relativePath)) return null;
  return path.join(projectRoot, path.normalize(relativePath));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function invalidateSceneModule(
  server: ViteDevServer,
  absolutePath: string,
): void {
  const mod = server.moduleGraph.getModuleById(absolutePath);
  if (mod) server.moduleGraph.invalidateModule(mod);
}

function sceneEditorScriptUrl(): string {
  const hostEntry = sceneEditorHostEntryPath().replace(/\\/g, "/");
  return `/@fs${hostEntry.startsWith("/") ? hostEntry : `/${hostEntry}`}`;
}

export function attachSceneEditorDevMiddleware(
  server: ViteDevServer,
  projectRoot: string,
): void {
  const pageHtml = readSceneEditorPageHtml().replace(
    SCENE_EDITOR_SCRIPT_PLACEHOLDER,
    sceneEditorScriptUrl(),
  );

  server.middlewares.use((req, res, next) => {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (url.pathname === SCENES_LIST_PATH && req.method === "GET") {
      sendJson(res, 200, listProjectScenes(projectRoot));
      return;
    }

    if (url.pathname === SCENE_API_PATH) {
      const file = url.searchParams.get("file")?.trim() ?? "";
      const absolute = resolveSceneAbsolutePath(projectRoot, file);
      if (!absolute) {
        sendJson(res, 400, { error: "invalid scene path" });
        return;
      }

      if (req.method === "GET") {
        try {
          const raw = fs.readFileSync(absolute, "utf8");
          const data = JSON.parse(raw) as unknown;
          sendJson(res, 200, data);
        } catch {
          sendJson(res, 404, { error: "scene not found" });
        }
        return;
      }

      if (req.method === "PUT") {
        void readBody(req)
          .then((body) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(body);
            } catch {
              sendJson(res, 400, { error: "invalid JSON" });
              return;
            }
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              sendJson(res, 400, { error: "scene must be a JSON object" });
              return;
            }
            fs.writeFileSync(
              absolute,
              `${JSON.stringify(parsed, null, 2)}\n`,
              "utf8",
            );
            invalidateSceneModule(server, absolute);
            res.statusCode = 204;
            res.end();
          })
          .catch(() => {
            sendJson(res, 500, { error: "failed to save scene" });
          });
        return;
      }

      sendJson(res, 405, { error: "method not allowed" });
      return;
    }

    const acceptsHtml =
      req.method === "GET" &&
      (req.headers.accept?.includes("text/html") ?? false);

    if (
      acceptsHtml &&
      url.pathname === "/" &&
      !url.searchParams.has(GAMEIDE_RUNTIME_QUERY)
    ) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(pageHtml);
      return;
    }

    next();
  });
}
