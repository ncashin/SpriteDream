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
import { transformGameModuleForHMR } from "./gameModuleHMRTransform";
export { ASSET_BASE_URL } from "../assetBaseURL.js";
export { SCENE_HMR_EVENT } from "../scene/sceneHMREvent.js";

const VIRTUAL_MODULE_PREFIX = /^gameide:/;

export type GameidePluginOptions = {
  /** @default true */
  enableGameModuleHMR?: boolean;
};

export function gameidePlugin({
  enableGameModuleHMR = true,
}: GameidePluginOptions = {}): Plugin {
  let projectRoot = process.cwd();
  let knownScenes: string[] = [];
  let isServe = false;

  return {
    name: "gameide-plugin",
    enforce: "post" as const,
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
      projectRoot = config.root;
      isServe = config.command === "serve";
    },
    transform(code, id) {
      if (!enableGameModuleHMR) return;
      return transformGameModuleForHMR(code, id, isServe);
    },
    resolveId(id) {
      if (id === VIRTUAL_ASSETS_MODULE) {
        return resolvedVirtualModuleId(id);
      }
    },
    configureServer(server) {
      knownScenes = listProjectScenes(projectRoot);
      attachFileEditorMiddleware(server, projectRoot, () => {
        invalidateCatalogModules(server);
        knownScenes = listProjectScenes(projectRoot);
      });
      return () => {
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
  };
}
