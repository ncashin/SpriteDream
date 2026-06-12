import type { SceneObject } from "../../../scene/scene.js";

const SCENE_SAVE_TYPES = [
  {
    description: "Scene files",
    accept: { "application/json": [".scene"] },
  },
];

export type PickSceneSavePathResult =
  | { kind: "written"; path: string }
  | { kind: "path"; path: string };

function suggestedSceneFileName(scenes: readonly string[]): string {
  const hasName = (name: string) =>
    scenes.some((scene) => scene === name || scene.endsWith(`/${name}`));
  if (!hasName("untitled.scene")) return "untitled.scene";
  let n = 2;
  while (hasName(`untitled-${n}.scene`)) n += 1;
  return `untitled-${n}.scene`;
}

function nextScenePath(
  scenes: readonly string[],
  dir: string,
  stem: string,
): string {
  const base = `${dir}${stem}.scene`;
  if (!scenes.includes(base)) return base;
  let n = 2;
  while (scenes.includes(`${dir}${stem}-${n}.scene`)) n += 1;
  return `${dir}${stem}-${n}.scene`;
}

function listSceneDirectories(scenes: readonly string[]): string[] {
  const dirs = new Set<string>();
  for (const scene of scenes) {
    const slash = scene.lastIndexOf("/");
    dirs.add(slash >= 0 ? scene.slice(0, slash + 1) : "");
  }
  if (dirs.size === 0) {
    dirs.add("source/scenes/");
  }
  return [...dirs].sort();
}

function promptSaveDirectory(scenes: readonly string[]): string | null {
  const dirs = listSceneDirectories(scenes);
  const defaultDir = dirs[0] ?? "source/scenes/";

  if (dirs.length === 1) {
    const saveHere = window.confirm(`Save scene to ${defaultDir}?`);
    return saveHere ? defaultDir : null;
  }

  const listing = dirs.map((dir, index) => `${index + 1}. ${dir}`).join("\n");
  const input = window.prompt(
    `Choose a directory for this scene file:\n${listing}\n\nEnter directory path:`,
    defaultDir,
  );
  if (input === null) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function scenePathForFileName(
  scenes: readonly string[],
  fileName: string,
  previousScenes: ReadonlySet<string>,
): string | null {
  const matches = scenes.filter(
    (scene) => scene === fileName || scene.endsWith(`/${fileName}`),
  );
  if (matches.length === 0) return null;
  const added = matches.filter((scene) => !previousScenes.has(scene));
  if (added.length === 1) return added[0];
  if (matches.length === 1) return matches[0];
  return null;
}

async function waitForScenePath(
  fileName: string,
  previousScenes: ReadonlySet<string>,
  reloadScenes: () => Promise<void>,
  getScenes: () => readonly string[],
): Promise<string | null> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await reloadScenes();
    const path = scenePathForFileName(getScenes(), fileName, previousScenes);
    if (path) return path;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

function canUseNativeSavePicker(): boolean {
  return typeof window.showSaveFilePicker === "function";
}

async function pickSceneSavePathNative(options: {
  scenes: readonly string[];
  content: SceneObject;
  reloadScenes: () => Promise<void>;
  getScenes: () => readonly string[];
}): Promise<PickSceneSavePathResult | null> {
  const { scenes, content, reloadScenes, getScenes } = options;
  const showSaveFilePicker = window.showSaveFilePicker;
  if (!showSaveFilePicker) return null;

  let handle: FileSystemFileHandle;
  try {
    handle = await showSaveFilePicker({
      suggestedName: suggestedSceneFileName(scenes),
      types: SCENE_SAVE_TYPES,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    throw error;
  }

  if (!handle.name.endsWith(".scene")) {
    window.alert("Scene files must use the .scene extension.");
    return null;
  }

  const previousScenes = new Set(scenes);
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(content, null, 2)}\n`);
  await writable.close();

  const relativePath = await waitForScenePath(
    handle.name,
    previousScenes,
    reloadScenes,
    getScenes,
  );

  if (!relativePath) {
    window.alert(
      "Scene was saved, but it must live inside the project folder to open in the editor.",
    );
    return null;
  }

  return { kind: "written", path: relativePath };
}

function pickSceneSavePathFallback(
  scenes: readonly string[],
): PickSceneSavePathResult | null {
  const directory = promptSaveDirectory(scenes);
  if (!directory) return null;
  return {
    kind: "path",
    path: nextScenePath(scenes, directory, "untitled"),
  };
}

export async function pickUntitledSceneSavePath(options: {
  scenes: readonly string[];
  content: SceneObject;
  reloadScenes: () => Promise<void>;
  getScenes: () => readonly string[];
}): Promise<PickSceneSavePathResult | null> {
  if (canUseNativeSavePicker()) {
    return pickSceneSavePathNative(options);
  }
  return pickSceneSavePathFallback(options.scenes);
}
