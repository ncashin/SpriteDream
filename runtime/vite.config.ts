import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";


export default defineConfig({
  base: "./",
  publicDir: "assets",
  plugins: [tailwindcss(), gameidePlugin()],
  server: {
    proxy: {
      "/api/forwarding": {
        target: "http://localhost:5175",
        changeOrigin: true,
      },
      // WebRTC signaling (HTTP + SSE) is served by the webapp
      "/game": {
        target: "http://localhost:5175",
        changeOrigin: true,
      },
    },
  },
});
