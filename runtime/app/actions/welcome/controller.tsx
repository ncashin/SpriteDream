import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { object, parse, string } from "remix/data-schema";
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import { Welcome } from "./welcome.tsx";

function projectDirectory(directory: string) {
  if (!isAbsolute(directory)) return;

  const absolute = resolve(directory);
  try {
    if (!statSync(absolute).isDirectory()) return;
  } catch {
    return;
  }

  return absolute;
}

const openProject = object({
  directory: string(),
});

export default createController(routes.welcome, {
  actions: {
    index(context) {
      return context.render(
        <Document title="SpriteDream">
          <Welcome />
        </Document>,
      );
    },
    async open(context) {
      const { directory } = parse(openProject, await context.request.json());
      const project = projectDirectory(directory);
      if (!project) return new Response("Not Found", { status: 404 });

      return Response.json({ href: routes.editor.index.href({ project }) });
    },
  },
});
