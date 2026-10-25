import { parseSafe } from "remix/data-schema";
import { createController } from "remix/router";

import { supportedFileType } from "./file-viewer.tsx";
import { editorRoutes } from "./routes.ts";

const skip = new Set(["node_modules", ".git"]);

async function listProjectFiles() {
  const { readdirSync } = await import("node:fs");
  const { relative, resolve, sep } = await import("node:path");
  const root = resolve(".");
  const files: string[] = [];

  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;

      const path = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        walk(path);
        continue;
      }

      if (!entry.isFile()) continue;

      files.push(relative(root, path).split(sep).join("/"));
    }
  }

  walk(root);
  files.sort();
  return files;
}

async function readProjectFile(filePath: string) {
  const { readFile } = await import("node:fs/promises");
  const { relative, resolve, sep } = await import("node:path");
  const root = resolve(".");
  const target = resolve(root, filePath);
  const fromRoot = relative(root, target);

  if (fromRoot.startsWith("..") || fromRoot === "" || fromRoot.split(sep).includes("..")) {
    return;
  }

  return readFile(target, "utf8");
}

async function writeProjectFile(filePath: string, content: string) {
  const { writeFile } = await import("node:fs/promises");
  const { relative, resolve, sep } = await import("node:path");
  const root = resolve(".");
  const target = resolve(root, filePath);
  const fromRoot = relative(root, target);

  if (fromRoot.startsWith("..") || fromRoot === "" || fromRoot.split(sep).includes("..")) {
    return false;
  }

  await writeFile(target, content, "utf8");
  return true;
}

export default createController(editorRoutes, {
  actions: {
    async listFiles() {
      return Response.json(await listProjectFiles());
    },
    async file(context) {
      const param = context.params.filePath;
      const filePath = Array.isArray(param) ? param.join("/") : param;
      if (!filePath) return new Response("Not Found", { status: 404 });

      let text: string;
      try {
        const content = await readProjectFile(filePath);
        if (content == null) return new Response("Not Found", { status: 404 });
        text = content;
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      const extension = filePath.split(".").pop();
      if (!parseSafe(supportedFileType, extension).success) {
        return new Response("Unsupported File Type", { status: 415 });
      }

      return new Response(text, { headers: { "content-type": "text/plain;charset=utf-8" } });
    },
    async saveFile(context) {
      const param = context.params.filePath;
      const filePath = Array.isArray(param) ? param.join("/") : param;
      if (!filePath) return new Response("Not Found", { status: 404 });

      const extension = filePath.split(".").pop();
      if (!parseSafe(supportedFileType, extension).success) {
        return new Response("Unsupported File Type", { status: 415 });
      }

      try {
        const written = await writeProjectFile(filePath, await context.request.text());
        if (!written) return new Response("Not Found", { status: 404 });
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      return new Response(null, { status: 204 });
    },
  },
});
