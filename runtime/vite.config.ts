import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";


export default defineConfig({
  base: "./",
  publicDir: "assets",
  plugins: [tailwindcss(), gameidePlugin()],
  optimizeDeps: {
    exclude: ["gameide"],
  },
});
