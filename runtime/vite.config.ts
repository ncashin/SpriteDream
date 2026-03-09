import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.env.GAMEIDE_RUNTIME_PORT ?? "38472") || 38472;

export default defineConfig({
  base: "/",
  resolve: {
    alias: {
      gameide: path.resolve(__dirname, "../gameide/src"),
    },
  },
  server: {
    port,
    strictPort: true,
    open: false,
    watch: {
      ignored: ["**/*.scene"],
    },
  },
});
