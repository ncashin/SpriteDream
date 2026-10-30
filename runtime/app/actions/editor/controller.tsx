import { isAbsolute } from "node:path";
import { createFileResponse } from "remix/response/file";
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import { Editor } from "./editor.tsx";
import { listProjectFiles, projectDirectory, readProjectFile, writeProjectFile } from "./project-files.ts";

function requestedDirectory(project: string) {
  try {
    const directory = decodeURIComponent(project);
    if (!isAbsolute(directory)) return;
    return directory;
  } catch {
    return;
  }
}

export default createController(routes.editor, {
  actions: {
    async index(context) {
      const requested = requestedDirectory(context.params.project);
      const directory = requested && (await projectDirectory(requested));
      if (!directory) return new Response("Not Found", { status: 404 });

      return context.render(
        <Document>
          <Editor />
        </Document>,
      );
    },
    async listFiles(context) {
      const requested = requestedDirectory(context.params.project);
      const directory = requested && (await projectDirectory(requested));
      if (!directory) return new Response("Not Found", { status: 404 });

      return Response.json(await listProjectFiles(directory));
    },
    async file(context) {
      const param = context.params.filePath;
      const filePath = Array.isArray(param) ? param.join("/") : param;
      if (!filePath) return new Response("Not Found", { status: 404 });

      const requested = requestedDirectory(context.params.project);
      const directory = requested && (await projectDirectory(requested));
      if (!directory) return new Response("Not Found", { status: 404 });

      const body = await readProjectFile(directory, filePath);
      if (!body) return new Response("Not Found", { status: 404 });

      try {
        const name = filePath.split("/").pop() ?? filePath;
        return await createFileResponse(new File([body], name), context.request);
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    },
    async saveFile(context) {
      const param = context.params.filePath;
      const filePath = Array.isArray(param) ? param.join("/") : param;
      if (!filePath) return new Response("Not Found", { status: 404 });

      const requested = requestedDirectory(context.params.project);
      const directory = requested && (await projectDirectory(requested));
      if (!directory) return new Response("Not Found", { status: 404 });

      const wrote = await writeProjectFile(
        directory,
        filePath,
        new Uint8Array(await context.request.arrayBuffer()),
      );
      if (!wrote) return new Response("Not Found", { status: 404 });

      return new Response(null, { status: 204 });
    },
  },
});
