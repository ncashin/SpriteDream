import { builtinModules } from "node:module";
import path from "node:path";
import type { UserConfig } from "vite";

const external = [
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default {
  build: {
    target: "node18",
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        cli: path.resolve(__dirname, "source/cli.ts"),
      },
      external,
      output: {
        format: "es",
        entryFileNames: "[name].js",
        inlineDynamicImports: true,
      },
    },
  },
} satisfies UserConfig;
