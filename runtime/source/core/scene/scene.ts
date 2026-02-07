import { writeFile, readFile } from "../fileUtilities";
import { isDevelopment, isEditorMode } from "../utils";
import { undoRedoManager } from "../editor/undoRedo";

export type SceneData = any;

let currentScene: SceneData | null = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;
let sceneSnapshot: SceneData | null = null;
let isInitializing = false;
let lastSavedContent: string | null = null;

const SAVE_DEBOUNCE_MS = 500;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function applyDiff(target: SceneData, diff: SceneData): void {
  for (const key in diff) {
    const diffVal = diff[key];
    const targetVal = target[key];
    if (isObject(diffVal) && isObject(targetVal)) {
      applyDiff(targetVal, diffVal);
    } else if (isObject(diffVal)) {
      target[key] = {};
      applyDiff(target[key], diffVal);
    } else {
      target[key] = diffVal;
    }
  }
}

function createProxy<T extends Record<string, unknown>>(
  obj: T,
  onSave: () => void,
  path: string = ""
): T {
  if (!isObject(obj)) return obj;

  return new Proxy(obj, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (!isObject(value)) return value;
      const propPath = path ? `${path}.${String(prop)}` : String(prop);
      return createProxy(value as Record<string, unknown>, onSave, propPath);
    },

    set(target, prop, value) {
      if (typeof prop === "symbol") return Reflect.set(target, prop, value);

      const oldValue = Reflect.get(target, prop);
      const propPath = path ? `${path}.${prop}` : prop;
      Reflect.set(target, prop, value);

      if (!undoRedoManager.isApplyingDiffs() && !isInitializing) {
        undoRedoManager.recordDiff(undoRedoManager.createDiff(propPath, oldValue, value, "set"));
        onSave();
      }
      return true;
    },

    deleteProperty(target, prop) {
      if (typeof prop === "symbol") return Reflect.deleteProperty(target, prop);

      const oldValue = Reflect.get(target, prop);
      Reflect.deleteProperty(target, prop);

      if (!undoRedoManager.isApplyingDiffs() && !isInitializing && oldValue !== undefined) {
        const propPath = path ? `${path}.${prop}` : prop;
        undoRedoManager.recordDiff(undoRedoManager.createDiff(propPath, oldValue, undefined, "delete"));
        onSave();
      }
      return true;
    },
  });
}

async function writeSceneFile(): Promise<void> {
  if (!currentFilePath || !persistenceEnabled || !currentScene) return;
  const content = JSON.stringify(currentScene, null, 2);
  if (lastSavedContent === content) return;
  await writeFile(currentFilePath, content);
  lastSavedContent = content;
}

function saveScene(): void {
  if (!currentFilePath || !persistenceEnabled || !currentScene) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await writeSceneFile();
    } catch (error) {
      console.error("Failed to save scene:", error);
    }
  }, SAVE_DEBOUNCE_MS);
}

function withoutPersistence(fn: () => void): void {
  const was = persistenceEnabled;
  persistenceEnabled = false;
  fn();
  persistenceEnabled = was;
}

function parseSceneData(input: SceneData | string): SceneData | null {
  if (typeof input !== "string") return isObject(input) ? input : null;
  try { return JSON.parse(input); } catch { return null; }
}

export function setScene(sceneData: SceneData | string): void {
  const data = parseSceneData(sceneData) ?? {};
  currentScene = createProxy(deepClone(data), saveScene);
}

export function hasScene(): boolean {
  return currentScene !== null;
}

export function getScene(): SceneData {
  if (!currentScene) currentScene = createProxy({}, saveScene);
  return currentScene;
}

export function getSceneSnapshot(): SceneData | null {
  return currentScene ? deepClone(currentScene) : null;
}

export function getSceneFilePath(): string | null {
  return currentFilePath;
}

export function setPersistenceEnabled(enabled: boolean): void {
  persistenceEnabled = enabled;
}

export function isPersistenceEnabled(): boolean {
  return persistenceEnabled;
}

export function saveSceneSnapshot(): void {
  sceneSnapshot = currentScene ? deepClone(currentScene) : null;
}

export async function restoreSceneFromSnapshot(): Promise<void> {
  if (!sceneSnapshot) return;
  isInitializing = true;
  currentScene = createProxy(deepClone(sceneSnapshot), saveScene);
  setTimeout(() => { isInitializing = false; }, 0);
}

export function patchScene(sceneData: SceneData | string): void {
  const data = parseSceneData(sceneData);
  if (!data) {
    console.warn("Invalid scene data for patch, skipping");
    return;
  }
  if (!currentScene) {
    setScene(data);
    return;
  }
  applyDiff(currentScene, data);
}

export function updateSceneWithDiff(diff: SceneData): void {
  if (!currentScene) {
    setScene(diff);
    if (sceneSnapshot) sceneSnapshot = deepClone(diff);
    return;
  }
  withoutPersistence(() => {
    applyDiff(currentScene, diff);
    if (sceneSnapshot) applyDiff(sceneSnapshot, diff);
  });
}

export async function flushSceneSave(): Promise<void> {
  if (!currentFilePath || !persistenceEnabled || !currentScene) return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    await writeSceneFile();
  } catch (error) {
    console.error("Failed to flush scene save:", error);
  }
}

export function mergeWithCurrentScene(incoming: SceneData): SceneData {
  if (!currentScene) return deepClone(incoming);

  const merged = deepClone(currentScene);
  for (const key in incoming) {
    const incomingVal = incoming[key];
    const existingVal = merged[key];
    merged[key] = isObject(incomingVal) && isObject(existingVal)
      ? { ...existingVal, ...deepClone(incomingVal) }
      : deepClone(incomingVal);
  }
  for (const key in merged) {
    if (!(key in incoming)) delete merged[key];
  }
  return merged;
}

async function loadSceneContent(filePath: string, content?: string): Promise<SceneData> {
  if (content !== undefined) return JSON.parse(content);
  if (!isDevelopment && !isEditorMode()) {
    throw new Error("Scene content must be provided in production mode");
  }
  return JSON.parse(await readFile(filePath));
}

export async function setSceneFile(filePath: string, content?: string): Promise<void> {
  try {
    const sceneData = await loadSceneContent(filePath, content);
    const isReload = currentFilePath === filePath && hasScene();
    const isNewFile = currentFilePath !== filePath;
    currentFilePath = filePath;

    if (isNewFile) undoRedoManager.clear();

    isInitializing = true;
    const nextSceneData = isReload ? mergeWithCurrentScene(sceneData) : sceneData;
    setScene(nextSceneData);
    lastSavedContent = JSON.stringify(nextSceneData, null, 2);
    setTimeout(() => { isInitializing = false; }, 0);
  } catch (error) {
    console.error("Failed to load scene:", error);
    currentFilePath = filePath;
    isInitializing = false;
    if (!hasScene()) setScene({});
  }
}
