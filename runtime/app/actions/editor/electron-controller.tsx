import { createFileResponse } from "remix/response/file";
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import { electronRequest } from "./electronIPC.ts";
import { Editor } from "./editor.tsx";

export default createController(routes.editor, {
  actions: {
    index(context) {
      if (!context.params.project)
        return new Response("Not Found", { status: 404 });

      return context.render(
        <Document>
          <Editor />
        </Document>,
      );
    },
    async listFiles(context) {
      const project = context.params.project;
      if (!project) return new Response("Not Found", { status: 404 });

      const electronResponse = await electronRequest({ type: "list-files", project });

      return Response.json(electronResponse.files ?? []);
    },
    async getFile(context) {
      const electronResponse = await electronRequest({
        type: "read-file",
        project: context.params.project,
        filePath: context.params.filePath,
      });

      if (!electronResponse.body) return new Response("Not Found", { status: 404 });

      try {
        const name = context.params.filePath.split("/").pop() ?? context.params.filePath;

        return await createFileResponse(
          new File([electronResponse.body], name),
          context.request,
        );

      } catch {
        return new Response("Not Found", { status: 404 });
      }
    },
    async saveFile(context) {
      const electronResponse = await electronRequest({
        type: "write-file",
        project: context.params.project,
        filePath: context.params.filePath,
        body: new Uint8Array(await context.request.arrayBuffer()),
      });

      if (electronResponse.ok !== true) return new Response("Not Found", { status: 404 });

      return new Response(null, { status: 204 });
    },
  },
});
