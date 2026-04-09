import * as path from "path";
import { defineConfig } from "vite";

const nodeBuiltins = [
  "vscode",
  "fs",
  "path",
  "child_process",
  "node:fs",
  "node:path",
  "node:child_process",
];

export default defineConfig({
  ssr: {
    // bundle gameide so the extension is self-contained
    noExternal: true,
  },
  build: {
    ssr: path.resolve(__dirname, "src/extension.ts"),
    outDir: "out",
    emptyOutDir: true,
    sourcemap: true,
    target: "node20",
    minify: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/extension.ts"),
      external: (id) => nodeBuiltins.includes(id) || id.startsWith("node:"),
      output: {
        format: "esm",
        entryFileNames: "extension.js",
        inlineDynamicImports: true,
      },
    },
  },
});
