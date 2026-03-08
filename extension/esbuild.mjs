import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "out/extension.js",
  sourcemap: true,
  external: ["vscode"],
  loader: { ".html": "text" },
});

if (watch) {
  await ctx.watch();
  console.log("Watching...");
} else {
  await ctx.rebuild();
  ctx.dispose();
}
