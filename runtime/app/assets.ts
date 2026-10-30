import { createAssetServer } from "remix/assets";
import { componentHmr } from "remix/component-hmr/assets";

const rootDir = process.cwd();
const nodeEnvironment = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnvironment === "development";
const isHMR = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

export const assets = createAssetServer({
  basePath: "/assets",
  rootDir,
  mounts: {
    app: "app",
    npm: "node_modules",
    game: "game",
    room: "room",
  },

  allowFiles: [
    "app/routes.ts",
    "app/utilities/**",
    "app/actions/editor/**",
    "app/actions/welcome/welcome.tsx",
    "room/protocol.ts",
    "room/room.tsx",
    "app/icon.tsx",
    "app/entry.ts",
    "game/**",
  ],
  allowPackages: ["remix", "lucide", "planck", "yjs"],
  denyFiles: ["app/**/*.test.*"],
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: isDevelopment,
  hmr: isHMR
    ? {
        channel: async () =>
          (await import("remix/node-hmr/runtime")).createBrowserHmrChannel(),
        moduleImporter: "remix/multiple-import-maps-polyfill",
      }
    : undefined,
  scripts: { loaders: isHMR ? [componentHmr()] : undefined },
});

const entry = "app/entry.ts";

export const scriptEntry = await assets.getScriptEntry(entry);
