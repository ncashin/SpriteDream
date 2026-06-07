import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { ViteDevServer } from "vite";

const FILE_WRITE_PATH = "/gameide/scene";

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

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function attachFileEditorMiddleware(
  server: ViteDevServer,
  projectRoot: string,
): void {
  server.middlewares.use((req, res, next) => {
    const hostHeader = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${hostHeader}`);
    if (url.pathname !== FILE_WRITE_PATH || req.method !== "POST") {
      next();
      return;
    }

    void readBody(req)
      .then((body) => {
        const payload = JSON.parse(body) as { path?: unknown; content?: unknown };
        if (
          typeof payload.path !== "string" ||
          !payload.content ||
          typeof payload.content !== "object"
        ) {
          res.statusCode = 400;
          res.end("invalid payload");
          return;
        }

        if (!isSafeSceneRelativePath(projectRoot, payload.path)) {
          res.statusCode = 400;
          res.end("invalid file path");
          return;
        }

        const absolute = path.join(projectRoot, path.normalize(payload.path));
        fs.writeFileSync(
          absolute,
          `${JSON.stringify(payload.content, null, 2)}\n`,
          "utf8",
        );
        res.statusCode = 204;
        res.end();
      })
      .catch(() => {
        res.statusCode = 500;
        res.end("failed to write file");
      });
  });
}
