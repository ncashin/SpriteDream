import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "gameide/vite";

export default defineConfig({
  plugins: [gameidePlugin(), react(), tailwindcss()],
});
