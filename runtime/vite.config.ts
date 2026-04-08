import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";

const port = parseInt(process.env.GAMEIDE_RUNTIME_PORT ?? "38472") || 38472;

export default defineConfig({
  base: "./",
  publicDir: "assets",
  plugins: [tailwindcss(), gameidePlugin()],
  server: {
    port,
    strictPort: false,
    open: false,
  },
});
