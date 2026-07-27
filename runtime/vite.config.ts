import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { gameidePlugin } from "./src/gameideVitePlugin/gameideVitePlugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), gameidePlugin()],
});
