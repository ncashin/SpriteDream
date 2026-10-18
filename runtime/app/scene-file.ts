import { isObject } from "./utilities/is-object.ts";
import type { SceneNode } from "./utilities/scene.ts";

export async function listSceneFiles(): Promise<string[]> {
  try {
    const { readdirSync } = await import("node:fs");
    const { resolve } = await import("node:path");
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

export async function readSceneFile(name: string): Promise<SceneNode | undefined> {
  if (!isSceneName(name)) return;
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const text = readFileSync(resolve("scenes", `${name}.json`), "utf8");
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return;
    return parsed;
  } catch {
    return;
  }
}

export async function writeSceneFile(name: string, scene: SceneNode): Promise<boolean> {
  if (!isSceneName(name)) return false;
  if (!(await listSceneFiles()).includes(name)) return false;
  const { writeFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  writeFileSync(resolve("scenes", `${name}.json`), `${JSON.stringify(scene, null, 2)}\n`);
  return true;
}
