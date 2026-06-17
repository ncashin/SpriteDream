import fs from "node:fs";
import type { Plugin } from "vite";
import { attachRoomWebSocket } from "../room/roomWebSocket.js";
import { SCENE_HMR_EVENT } from "../scene/sceneHMREvent.js";
import type { SceneObject } from "../scene/scene.js";
import {
  catalogFileAffects,
  invalidateCatalogModules,
  listProjectScenes,
  loadCatalogModule,
  resolvedVirtualModuleId,
  toPosixRelative,
  VIRTUAL_ASSETS_MODULE,
} from "./virtualCatalog";
import { attachFileEditorMiddleware } from "./fileEditor";
import { loadSceneModule } from "./sceneVirtualModule";
import { transformLifecycleHMR } from "./lifecycleHMR/transform";

export { ASSET_BASE_URL } from "../assetBaseURL.js";
export { SCENE_HMR_EVENT } from "../scene/sceneHMREvent.js";

const VIRTUAL_MODULE_PREFIX = /^gameide:/;

export function gameidePlugin(): Plugin {
  let isServe = false;
  let projectRoot = process.cwd();
  let knownScenes: string[] = [];

  return {
    name: "gameide-plugin",
    enforce: "post",
    config() {
      return {
        build: {
          assetsInlineLimit: 0,
        },
        optimizeDeps: {
          exclude: ["gameide"],
          esbuildOptions: {
            plugins: [
              {
                name: "gameide-virtual-modules",
                setup(build) {
                  build.onResolve({ filter: VIRTUAL_MODULE_PREFIX }, (args) => ({
                    path: args.path,
                    external: true,
                  }));
                },
              },
            ],
          },
        },
      };
    },
    configResolved(config) {
      isServe = config.command === "serve";
      projectRoot = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ASSETS_MODULE) {
        return resolvedVirtualModuleId(id);
      }
    },
    configureServer(server) {
      knownScenes = listProjectScenes(projectRoot);
      return () => {
        attachFileEditorMiddleware(server, projectRoot, () => {
          invalidateCatalogModules(server);
          knownScenes = listProjectScenes(projectRoot);
        });
        if (server.httpServer) {
          attachRoomWebSocket(server.httpServer);
        }
      };
    },
    handleHotUpdate({ file, server }) {
      if (catalogFileAffects(projectRoot, file, knownScenes)) {
        invalidateCatalogModules(server);
      }
      knownScenes = listProjectScenes(projectRoot);

      if (file.endsWith(".scene")) {
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf8")) as SceneObject;
          server.ws.send({
            type: "custom",
            event: SCENE_HMR_EVENT,
            data: {
              path: toPosixRelative(projectRoot, file),
              data,
            },
          });
        } catch {}
      }
    },
    load(id: string) {
      return loadCatalogModule(id, projectRoot) ?? loadSceneModule(id, projectRoot);
    },
    transform(code, id) {
      return transformLifecycleHMR(code, id, isServe);
    },
  };
}
