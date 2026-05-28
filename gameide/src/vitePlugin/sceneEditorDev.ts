import fs from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ViteDevServer } from "vite";
import { listProjectScenes } from "./projectCatalog";
import {
  attachDevSceneChannelHost,
  type DevSceneChannelHost,
} from "./sceneChannelHost";

const SCENES_LIST_PATH = "/__gameide/scenes";
const SCENE_CHANNEL_PATH = "/__gameide/scene/channel";

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
): DevSceneChannelHost {
  const host = attachDevSceneChannelHost(server, projectRoot);

  server.middlewares.use((req, res, next) => {
    const hostHeader = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${hostHeader}`);

    if (url.pathname === SCENES_LIST_PATH && req.method === "GET") {
      sendJson(res, 200, listProjectScenes(projectRoot));
      return;
    }

    if (url.pathname === SCENE_CHANNEL_PATH && req.method === "POST") {
      void readBody(req)
        .then((body) => {
          try {
            host.handleMessage(JSON.parse(body) as unknown);
            res.statusCode = 204;
            res.end();
          } catch {
            sendJson(res, 400, { error: "invalid JSON" });
          }
        })
        .catch(() => {
          sendJson(res, 500, { error: "failed to handle scene channel message" });
        });
      return;
    }

    next();
  });

  return host;
}
