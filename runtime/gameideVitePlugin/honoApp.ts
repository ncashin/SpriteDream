import { Hono } from "hono";
import { lookup } from "mime-types";
import fs from "node:fs/promises";
import path from "node:path";

export const app = new Hono();

app.get("/api/files", async (context) => {
  const root = path.join(process.cwd());
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
