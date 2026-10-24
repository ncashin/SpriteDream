import { createController } from "remix/router";

import { noteSceneSaved, sceneForSave } from "../../room.ts";
import { listSceneFiles, readSceneFile, writeSceneFile } from "../../scene-file.ts";
import { isObject } from "../../utilities/is-object.ts";
import { routes } from "../../routes.ts";

export default createController(routes.editor, {
  actions: {
    async scenes() {
      return Response.json(await listSceneFiles());
    },
    async scene(context) {
      const scene = await readSceneFile(context.params.name);
      if (!scene) return new Response("Not Found", { status: 404 });
      return Response.json(scene);
    },
    async saveScene(context) {
      const body: unknown = await context.request.json().catch(() => undefined);
      const value = sceneForSave() ?? body;
      if (!isObject(value) || !(await writeSceneFile(context.params.name, value))) {
        return new Response("Not Found", { status: 404 });
      }
      noteSceneSaved(value);
      return new Response(null, { status: 204 });
    },
  },
});
