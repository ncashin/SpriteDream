import { createController } from "remix/router";
import { route } from "remix/routes";

export const editorRoutes = route("/editor", {});

export default createController(editorRoutes, {
  actions: {},
});
