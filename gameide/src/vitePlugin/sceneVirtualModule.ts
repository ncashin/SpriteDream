import fs from "node:fs";
import { SCENE_HMR_EVENT } from "../scene/sceneHMREvent.js";
import type { SceneObject } from "../scene/scene.js";
import { toPosixRelative } from "./virtualCatalog";

function createSceneModuleCode(data: SceneObject, relativePath: string): string {
  return (
    `const data = ${JSON.stringify(data)};\n` +
    `export default data;\n` +
    `if (import.meta.hot) import.meta.hot.accept((mod) => {\n` +
    `  window.dispatchEvent(new CustomEvent(${JSON.stringify(SCENE_HMR_EVENT)}, { detail: { path: ${JSON.stringify(relativePath)}, data: mod.default } }));\n` +
    `});\n`
  );
}

export function loadSceneModule(id: string, projectRoot: string): string | undefined {
  const filePath = id.replace(/\?.*$/, "");
  if (!filePath.endsWith(".scene")) return;

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    const relativePath = toPosixRelative(projectRoot, filePath);
    return `throw new Error(${JSON.stringify(`Scene not found: ${relativePath}`)});\n`;
  }
  const data = JSON.parse(raw) as SceneObject;
  const relativePath = toPosixRelative(projectRoot, filePath);
  return createSceneModuleCode(data, relativePath);
}
