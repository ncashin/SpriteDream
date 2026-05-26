const templateRoot = "../template/";

const templateModules = import.meta.glob<string>(
  [
    "../template/.gitignore",
    "../template/index.html",
    "../template/package.json",
    "../template/tsconfig.json",
    "../template/vite.config.ts",
    "../template/assets/**/*",
    "../template/source/**/*",
  ],
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
) as Record<string, string>;

export const templateFiles: Record<string, string> = Object.fromEntries(
  Object.entries(templateModules).map(([templatePath, content]) => [
    templatePath.slice(templateRoot.length),
    content,
  ]),
);
