import { createController } from "remix/router";

import { editorRoutes } from "./routes.ts";

const skip = new Set(["node_modules", ".git"]);

async function listFiles() {
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

export default createController(editorRoutes, {
  actions: {
    async listFiles() {
      return Response.json(await listFiles());
    },
  },
});
