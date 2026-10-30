import { array, string } from "remix/data-schema";
import { get, put, route } from "remix/routes";

export const projectFiles = array(string());

export const editorRoutes = route({
  index: get("/"),
  listFiles: get("/files"),
  file: get("/file/*filePath"),
  saveFile: put("/file/*filePath"),
});
