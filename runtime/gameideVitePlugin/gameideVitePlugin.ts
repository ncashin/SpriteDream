import fs from "node:fs/promises";
import { type Plugin } from "vite";
import { app } from "./honoApp";
import { diffScene, sceneCache } from "./sceneHMR";

export const gameidePlugin = (): Plugin => ({
  name: "gameide",

  async handleHotUpdate({ file, server }) {
    if (!file.endsWith(".scene")) {
      return;
    }

    const content = await fs.readFile(file, "utf8");
    const nextScene = JSON.parse(content);

    const previousScene = sceneCache.get(file) ?? {};
    const patch = diffScene(previousScene, nextScene);

    sceneCache.set(file, nextScene);

    server.ws.send({
      type: "custom",
      event: "gameide:scene",
      data: {
        file,
        patch,
      },
    });

    return [];
  },
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url) {
        next();
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host}`);
      const match = app.router.match(request.method ?? "GET", url.pathname);

      if (match[0].length === 0) {
        next();
        return;
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      }

      const honoRequest = new Request(url, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : new ReadableStream({
                start(controller) {
                  request.on("data", (chunk) => controller.enqueue(chunk));
                  request.on("end", () => controller.close());
                  request.on("error", (error) => controller.error(error));
                },
              }),

        // TODO: Fix typing issue
        // @ts-ignore
        duplex: "half",
      });

      const honoResponse = await app.fetch(honoRequest);

      response.statusCode = honoResponse.status;

      honoResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
      });

      response.end(await honoResponse.text());
    });
  },
});
