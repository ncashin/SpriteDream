import { Hono } from "hono";
import { lookup } from "mime-types";
import fs from "node:fs/promises";
import path from "node:path";
import { type Plugin } from "vite";

const app = new Hono();

app.get("/api/files", async (context) => {
  const root = path.join(process.cwd());
  console.log(root);
  try {
    const files: string[] = [];

    const walk = async (director: string) => {
      const entries = await fs.readdir(director, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(director, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
        }
      }
    };

    await walk(root);

    return context.json(files);
  } catch {
    return context.json({ error: "Failed to read files" }, 500);
  }
});

app.get("/api/files/:path{.+}", async (context) => {
  const relativePath = context.req.param("path");
  const fullPath = path.join(process.cwd(), relativePath);

  try {
    const data = await fs.readFile(fullPath);

    return context.body(data, 200, {
      "Content-Type": lookup(fullPath) || "application/octet-stream",
    });
  } catch {
    return context.json({ error: "File not found" }, 404);
  }
});

app.post("/api/files/:path{.+}", async (context) => {
  const relativePath = context.req.param("path");

  const body = await context.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    return context.text("File is required", 400);
  }

  const currentDirectory = path.resolve(process.cwd());
  const fullPath = path.resolve(currentDirectory, relativePath);

  if (!fullPath.startsWith(currentDirectory + path.sep)) {
    return context.text("Invalid path", 403);
  }

  await fs.mkdir(path.dirname(fullPath), {
    recursive: true,
  });

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, fileBuffer);

  return context.body(null, 204);
});

export const gameidePlugin = (): Plugin => ({
  name: "gameide",

  handleHotUpdate({ file, server }) {
    if (!file.endsWith(".scene")) {
      return;
    }

    server.ws.send({
      type: "custom",
      event: "gameide:scene",
      data: {
        file,
      },
    });

    return [];
  },
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url) {
        next();
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host}`);
      const match = app.router.match(request.method ?? "GET", url.pathname);

      if (match[0].length === 0) {
        next();
        return;
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      }

      const honoRequest = new Request(url, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : new ReadableStream({
                start(controller) {
                  request.on("data", (chunk) => controller.enqueue(chunk));
                  request.on("end", () => controller.close());
                  request.on("error", (error) => controller.error(error));
                },
              }),

        // TODO: Fix typing issue
        // @ts-ignore
        duplex: "half",
      });

      const honoResponse = await app.fetch(honoRequest);

      response.statusCode = honoResponse.status;

      honoResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
      });

      response.end(await honoResponse.text());
    });
  },
});
