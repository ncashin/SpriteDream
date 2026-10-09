import { createAssetServer } from "remix/assets";
import { componentHmr } from "remix/component-hmr/assets";

const rootDir = process.cwd();
const nodeEnvironment = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnvironment === "development";
const isHMR = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

export const assets = createAssetServer({
  basePath: "/assets",
  rootDir,

  allowFiles: [
    "app/routes.ts",
    "app/utilities/**",
    "app/actions/game/game.tsx",
    "app/actions/editor/object-tree.tsx",
    "app/actions/editor/Search.tsx",
    "app/actions/editor/property-input.tsx",
    "app/actions/editor/matrix-input.tsx",
    "app/actions/editor/sidebar.tsx",
    "app/icon.tsx",
    "app/**/public/**",
  ],
  allowPackages: ["remix", "lucide"],
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

const entry = "app/actions/public/entry.ts";

export const scriptEntry = await assets.getScriptEntry(entry);
