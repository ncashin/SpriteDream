import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";

export default defineConfig({
  base: "./",
  plugins: [gameidePlugin(), react(), tailwindcss()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        // Pixi v8 lazy-loads renderers via import() this breaks things in rollup vite
        manualChunks(id) {
          if (
            id.includes("node_modules/pixi.js") ||
            id.includes("node_modules/@pixi/")
          ) {
            return "pixi";
          }
        },
      },
    },
  },
});
