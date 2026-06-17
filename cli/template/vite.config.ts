import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";

export default defineConfig({
  // Relative base so uploaded bundles resolve assets under /game/:id/embed/.
  base: "./",
  plugins: [gameidePlugin(), react(), tailwindcss()],
});
