import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  stripScenePatchSentinels,
  type SceneObject,
} from "../scene/scene.js";
import { catalogFileAffectsScenes, listProjectScenes } from "./projectCatalog";
import { invalidateCatalogModules } from "./virtualCatalog";

const SCENES_PATH = "/__gameide/scenes";
const SCENE_FILE_PATH = "/__gameide/scene";

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

function readSceneFile(absolutePath: string): SceneObject {
  const raw = fs.readFileSync(absolutePath, "utf8");
  return stripScenePatchSentinels(JSON.parse(raw) as SceneObject);
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

export function attachSceneEditorDevMiddleware(
  server: ViteDevServer,
  projectRoot: string,
): void {
  for (const relativePath of listProjectScenes(projectRoot)) {
    server.watcher.add(path.join(projectRoot, relativePath));
  }

  const onSceneCatalogChange = (file: string): void => {
    if (!catalogFileAffectsScenes(path.normalize(file))) return;
    server.watcher.add(file);
    invalidateCatalogModules(server);
  };

  server.watcher.on("add", onSceneCatalogChange);
  server.watcher.on("unlink", onSceneCatalogChange);

  server.middlewares.use((req, res, next) => {
    const hostHeader = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${hostHeader}`);

    if (url.pathname === SCENES_PATH && req.method === "GET") {
      sendJson(res, 200, listProjectScenes(projectRoot));
      return;
    }

    if (url.pathname !== SCENE_FILE_PATH) {
      next();
      return;
    }

    if (req.method === "GET") {
      const relativePath = url.searchParams.get("path") ?? "";
      const absolute = resolveSceneAbsolutePath(projectRoot, relativePath);
      if (!absolute) {
        sendJson(res, 400, { error: "invalid scene path" });
        return;
      }

      try {
        sendJson(res, 200, readSceneFile(absolute));
      } catch {
        sendJson(res, 404, { error: "scene not found" });
      }
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    void readBody(req)
      .then((body) => {
        const payload = JSON.parse(body) as {
          path?: unknown;
          content?: unknown;
        };
        if (
          typeof payload.path !== "string" ||
          !payload.content ||
          typeof payload.content !== "object"
        ) {
          sendJson(res, 400, { error: "invalid payload" });
          return;
        }

        const absolute = resolveSceneAbsolutePath(projectRoot, payload.path);
        if (!absolute) {
          sendJson(res, 400, { error: "invalid scene path" });
          return;
        }

        const data = stripScenePatchSentinels(payload.content as SceneObject);
        fs.writeFileSync(absolute, `${JSON.stringify(data, null, 2)}\n`, "utf8");
        res.statusCode = 204;
        res.end();
      })
      .catch(() => {
        sendJson(res, 500, { error: "failed to save scene" });
      });
  });
}
