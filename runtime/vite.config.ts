import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gameidePlugin } from "./gameideVitePlugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), gameidePlugin()],
});
