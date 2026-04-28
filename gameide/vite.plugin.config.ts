import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/vitePlugin/gameidePluginVite.ts"),
      formats: ["es"],
      fileName: () => "vite.js",
    },
    rollupOptions: {
      external: ["vite", "node:fs", "node:path", "fs", "path"],
    },
    sourcemap: true,
    target: "node20",
  },
});
