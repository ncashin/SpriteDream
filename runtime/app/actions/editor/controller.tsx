import { createController } from "remix/router";

import { noteSceneSaved } from "../../room.ts";
import { listSceneFiles, readSceneFile, writeSceneFile } from "../../scene-file.ts";
import { isObject } from "../../utilities/is-object.ts";
import { routes } from "../../routes.ts";

export default createController(routes.editor, {
  actions: {
    scenes() {
      return Response.json(listSceneFiles());
    },
    scene(context) {
      const scene = readSceneFile(context.params.name);
      if (!scene) return new Response("Not Found", { status: 404 });
      return Response.json(scene);
    },
    async saveScene(context) {
      const body: unknown = await context.request.json().catch(() => undefined);
      if (!isObject(body) || !writeSceneFile(context.params.name, body)) {
        return new Response("Not Found", { status: 404 });
      }
      noteSceneSaved(body);
      return new Response(null, { status: 204 });
    },
  },
});
