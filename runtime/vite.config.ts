import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [gameidePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      source: fileURLToPath(new URL("./source/index.ts", import.meta.url)),
    },
  },
  build: {
    assetsInlineLimit: 0,
  },
});
