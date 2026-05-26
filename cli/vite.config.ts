import { builtinModules } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";

const external = [
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  build: {
    target: "node18",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      preserveEntrySignatures: "exports-only",
      input: {
        index: path.resolve(__dirname, "source/index.ts"),
        cli: path.resolve(__dirname, "source/cli.ts"),
      },
      external,
      output: {
        format: "es",
        entryFileNames: "[name].js",
        minifyInternalExports: false,
      },
    },
  },
});
