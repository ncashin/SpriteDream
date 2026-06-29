import fs from "node:fs";
import type { SceneObject } from "../scene/scene.js";
import { toPosixRelative } from "./virtualCatalog";

function createSceneModuleCode(data: SceneObject): string {
  return (
    `const data = ${JSON.stringify(data)};\n` +
    `export default data;\n` +
    `if (import.meta.hot) import.meta.hot.accept();\n`
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
  return createSceneModuleCode(data);
}
