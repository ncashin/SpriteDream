import { array, string } from "remix/data-schema";
import { get, route } from "remix/routes";

export const projectFiles = array(string());

export const editorRoutes = route({
  listFiles: get("/files"),
});
