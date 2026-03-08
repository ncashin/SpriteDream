import { defineConfig } from "vite";

const port = parseInt(process.env.GAMEIDE_RUNTIME_PORT ?? "38472") || 38472;

export default defineConfig({
  server: {
    port,
    strictPort: true,
    open: false,
  },
});
