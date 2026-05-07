import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runtimeAssetsPlugin(assetsDir: string): Plugin {
  let outDir = "dist";

  return {
    name: "runtime-local-assets",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/assets", (req, res, next) => {
        const rawUrl = req.url?.split("?")[0] ?? "";
        let pathname = decodeURIComponent(rawUrl);
        if (pathname.startsWith("/")) pathname = pathname.slice(1);
        if (!pathname || pathname.includes("..")) {
          next();
          return;
        }
        const resolvedAssets = path.resolve(assetsDir);
        const resolvedFile = path.resolve(path.join(assetsDir, pathname));
        if (
          resolvedFile !== resolvedAssets &&
          !resolvedFile.startsWith(resolvedAssets + path.sep)
        ) {
          next();
          return;
        }
        void fs
          .readFile(resolvedFile)
          .then((buf) => {
            const ext = path.extname(resolvedFile).toLowerCase();
            const mime: Record<string, string> = {
              ".svg": "image/svg+xml",
              ".glb": "model/gltf-binary",
              ".png": "image/png",
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".webp": "image/webp",
              ".gif": "image/gif",
              ".json": "application/json",
            };
            res.setHeader(
              "Content-Type",
              mime[ext] ?? "application/octet-stream",
            );
            res.end(buf);
          })
          .catch(() => next());
      });
    },
    async closeBundle() {
      try {
        await fs.access(assetsDir);
      } catch {
        return;
      }
      await fs.cp(assetsDir, path.join(outDir, "assets"), { recursive: true });
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [
    gameidePlugin(),
    react(),
    tailwindcss(),
    runtimeAssetsPlugin(path.resolve(__dirname, "assets")),
  ],
  build: {
    assetsInlineLimit: 0,
  },
});
