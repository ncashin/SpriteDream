import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { existsSync } from "fs";
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootCandidates = [
  path.resolve(configDir, ".."),
  configDir,
];
const repoRoot =
  repoRootCandidates.find((candidate) =>
    existsSync(path.join(candidate, "runtime", "source"))
  ) ?? configDir;
export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
