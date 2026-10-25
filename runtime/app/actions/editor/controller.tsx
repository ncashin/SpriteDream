import { createController } from "remix/router";

import { Document } from "../document.tsx";
import { FileViewer } from "./file-viewer.tsx";
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

      const content = <FileViewer file={{ path: filePath, content: text }} />;
      const isFrameRequest = context.request.headers.get("X-Remix-Frame") === "true";
      if (isFrameRequest) return context.render(content);

      return context.render(<Document title={filePath}>{content}</Document>);
    },
  },
});
