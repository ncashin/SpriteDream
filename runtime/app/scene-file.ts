import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SceneNode } from "./utilities/scene.ts";

export function listSceneFiles(): string[] {
  try {
    return readdirSync(resolve("scenes"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -".json".length))
      .filter((name) => isSceneName(name))
      .sort();
  } catch {
    return [];
  }
}

function isSceneName(name: string) {
  return name !== "." && name !== ".." && /^[\w. -]+$/.test(name);
}

export function readSceneFile(name: string): SceneNode | undefined {
  if (!isSceneName(name)) return;
  try {
    const text = readFileSync(resolve("scenes", `${name}.json`), "utf8");
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return;
    return parsed;
  } catch {
    return;
  }
}

export function writeSceneFile(name: string, scene: SceneNode): boolean {
  if (!isSceneName(name)) return false;
  if (!listSceneFiles().includes(name)) return false;
  writeFileSync(resolve("scenes", `${name}.json`), `${JSON.stringify(scene, null, 2)}\n`);
  return true;
}
