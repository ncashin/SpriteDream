import { openLazyFile, writeFile } from "remix/fs";
import { createFileResponse } from "remix/response/file";
import { createController } from "remix/router";

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

async function projectFilePath(filePath: string) {
  const { relative, resolve, sep } = await import("node:path");
  const root = resolve(".");
  const target = resolve(root, filePath);
  const fromRoot = relative(root, target);

  if (fromRoot.startsWith("..") || fromRoot === "" || fromRoot.split(sep).includes("..")) {
    return;
  }

  return target;
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

      const target = await projectFilePath(filePath);
      if (!target) return new Response("Not Found", { status: 404 });

      try {
        return await createFileResponse(openLazyFile(target), context.request);
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    },
    async saveFile(context) {
      const param = context.params.filePath;
      const filePath = Array.isArray(param) ? param.join("/") : param;
      if (!filePath) return new Response("Not Found", { status: 404 });

      const target = await projectFilePath(filePath);
      if (!target) return new Response("Not Found", { status: 404 });

      try {
        const type = context.request.headers.get("content-type") ?? "";
        const name = filePath.split("/").pop() ?? filePath;
        const file = new File([await context.request.arrayBuffer()], name, { type });
        await writeFile(target, file);
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      return new Response(null, { status: 204 });
    },
  },
});
