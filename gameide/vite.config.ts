import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), dts({ include: ["src"] })],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "gameide",
      formats: ["es", "umd"],
      fileName: (format) => `gameide.${format}.js`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "pixi.js",
        "clsx",
        "lucide-react",
        "tailwind-merge",
        "tiny-invariant",
        "node:fs",
        "node:path",
        "fs",
        "path",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "pixi.js": "PIXI",
        },
      },
    },
    sourcemap: true,
    target: "es2020",
  },
});
