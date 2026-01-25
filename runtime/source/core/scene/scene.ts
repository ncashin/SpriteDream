import { writeFile, readFile } from "../fileUtilities";
import { isDevelopment, isEditorMode } from "../utils";
import { undoRedoManager } from "../editor/undoRedo";

export type SceneData = any;

let currentScene: SceneData | null = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;
let sceneSnapshot: SceneData | null = null;
let isInitializing = false; // Flag to prevent undo recording during scene initialization

const DEFAULT_SCENE: SceneData = {};
const SAVE_DEBOUNCE_MS = 500;

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date)
  );
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function mergeObjects<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>
): T {
  const merged = deepClone(existing);

  for (const key in incoming) {
    const incomingValue = incoming[key];
    const existingValue = merged[key];

    if (isObject(incomingValue) && isObject(existingValue)) {
      merged[key] = mergeObjects(
        existingValue as Record<string, unknown>,
        incomingValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else {
      merged[key] = deepClone(incomingValue) as T[Extract<keyof T, string>];
    }
  }

  for (const key in merged) {
    if (!(key in incoming)) {
      delete merged[key];
    }
  }

  return merged;
}

function mergeSceneData<T extends Record<string, unknown>>(
  existing: T | null,
  incoming: T
): T {
  if (!existing) return deepClone(incoming);
  return mergeObjects(existing, incoming);
}

export function mergeWithCurrentScene(incoming: SceneData): SceneData {
  return mergeSceneData(currentScene, incoming);
}

function createPersistentProxy<T extends Record<string, unknown>>(
  obj: T,
  onSave: (sceneData: SceneData) => void,
  path: string = ""
): T {
  if (!isObject(obj)) return obj;
  return new Proxy(obj, {
    set(target: T, property: string | symbol, value: unknown): boolean {
      if (typeof property === "symbol") {
        Reflect.set(target, property, value);
        return true;
      }
      const oldValue = Reflect.get(target, property);

      // If the value is an object, wrap it in a proxy before setting
      let proxiedValue = value;
      if (isObject(value)) {
        const currentPath = path ? `${path}.${property}` : property;
        proxiedValue = createPersistentProxy(
          value as Record<string, unknown>,
          onSave,
          currentPath
        ) as unknown;
      }

      Reflect.set(target, property, proxiedValue);
      const currentPath = path ? `${path}.${property}` : property;

      // Only record diff if we're not currently applying diffs (undo/redo) and not initializing
      if (!undoRedoManager.isApplyingDiffs() && !isInitializing) {
        undoRedoManager.recordDiff(
          undoRedoManager.createDiff(
            currentPath,
            oldValue !== undefined ? oldValue : undefined,
            proxiedValue,
            "set"
          )
        );
        onSave(currentScene!);
      }
      return true;
    },

    deleteProperty(target: T, property: string | symbol): boolean {
      if (typeof property === "symbol") {
        Reflect.deleteProperty(target, property);
        return true;
      }
      const oldValue = Reflect.get(target, property);
      Reflect.deleteProperty(target, property);
      const currentPath = path ? `${path}.${property}` : property;

      // Only record diff if we're not currently applying diffs (undo/redo) and not initializing
      if (!undoRedoManager.isApplyingDiffs() && !isInitializing) {
        if (oldValue !== undefined) {
          undoRedoManager.recordDiff(
            undoRedoManager.createDiff(currentPath, oldValue, undefined, "delete")
          );
        }
        onSave(currentScene!);
      }
      return true;
    },

    get(target: T, property: string | symbol): unknown {
      const value = Reflect.get(target, property);

      // If the value is an object, return a proxied version
      if (isObject(value)) {
        const currentPath = path ? `${path}.${String(property)}` : String(property);
        return createPersistentProxy(
          value as Record<string, unknown>,
          onSave,
          currentPath
        );
      }

      return value;
    },
  });
}

function applyDiffRecursive(
  target: SceneData,
  diff: SceneData
): void {
  for (const key in diff) {
    const diffValue = diff[key];
    const targetValue = target[key];

    if (isObject(diffValue) && isObject(targetValue)) {
      applyDiffRecursive(targetValue as SceneData, diffValue as SceneData);
    } else if (isObject(diffValue)) {
      target[key] = {};
      applyDiffRecursive(target[key] as SceneData, diffValue as SceneData);
    } else {
      target[key] = diffValue;
    }
  }
}

function applyDiffToScene(diff: SceneData, skipSave: boolean = false): void {
  if (!currentScene) {
    setScene(diff);
    if (sceneSnapshot) {
      sceneSnapshot = deepClone(diff);
    }
    return;
  }

  const wasPersistenceEnabled = persistenceEnabled;
  if (skipSave) {
    persistenceEnabled = false;
  }

  applyDiffRecursive(currentScene, diff);

  if (sceneSnapshot) {
    applyDiffRecursive(sceneSnapshot, diff);
  }

  persistenceEnabled = wasPersistenceEnabled;
}

export function updateSceneWithDiff(diff: SceneData): void {
  applyDiffToScene(diff, true);
}

function saveScene(filePath: string, sceneData: SceneData): void {
  if (!filePath || !persistenceEnabled) return;

  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    try {
      await writeFile(filePath, JSON.stringify(sceneData, null, 2));
    } catch (error) {
      console.error("Failed to save scene:", error);
    }
  }, SAVE_DEBOUNCE_MS);
}

export function setScene(sceneData: SceneData | string): void {
  let data: SceneData;

  if (typeof sceneData === "string") {
    try {
      data = JSON.parse(sceneData);
    } catch {
      console.warn("Invalid scene JSON, using default scene");
      data = DEFAULT_SCENE;
    }
  } else {
    data = sceneData || DEFAULT_SCENE;
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    data = DEFAULT_SCENE;
  }

  const onSave = currentFilePath ? (d: SceneData) => saveScene(currentFilePath!, d) : () => { };
  currentScene = createPersistentProxy(deepClone(data), onSave);
}

export function hasScene(): boolean {
  return currentScene !== null;
}

export function getScene(): SceneData {
  if (!currentScene) {
    const onSave = currentFilePath
      ? (data: SceneData) => saveScene(currentFilePath!, data)
      : () => { };
    currentScene = createPersistentProxy(DEFAULT_SCENE, onSave);
  }

  return currentScene!;
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

export function saveSceneSnapshot() {
  sceneSnapshot = currentScene ? deepClone(currentScene) : null;
}

export async function restoreSceneFromSnapshot(): Promise<void> {
  if (!sceneSnapshot) return;

  // Prevent undo recording during snapshot restoration
  const wasInitializing = isInitializing;
  isInitializing = true;
  try {
    const onSave = currentFilePath
      ? (data: SceneData) => saveScene(currentFilePath!, data)
      : () => { };
    currentScene = createPersistentProxy(deepClone(sceneSnapshot), onSave);
  } finally {
    // Use setTimeout to ensure any operations triggered by restoration
    // (like ECS updates) are also covered by the initialization flag
    setTimeout(() => {
      isInitializing = wasInitializing;
    }, 0);
  }
}

export function patchScene(sceneData: SceneData | string): void {
  let data: SceneData;

  if (typeof sceneData === "string") {
    try {
      data = JSON.parse(sceneData);
    } catch {
      console.warn("Invalid scene JSON, skipping patch");
      return;
    }
  } else {
    data = sceneData;
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    console.warn("Invalid scene data for patch, skipping");
    return;
  }

  if (!currentScene) {
    setScene(data);
    return;
  }


  applyDiffRecursive(currentScene, data);
}

export async function setSceneFile(
  filePath: string,
  content?: string
): Promise<void> {
  try {
    let sceneData: SceneData;

    if (content !== undefined) {
      sceneData = JSON.parse(content) as SceneData;
    } else {
      if (!isDevelopment && !isEditorMode()) {
        throw new Error("Scene content must be provided in production mode");
      }
      const fileContent = await readFile(filePath);
      sceneData = JSON.parse(fileContent) as SceneData;
    }

    const isReload = currentFilePath === filePath && hasScene();
    const isNewFile = currentFilePath !== filePath;
    currentFilePath = filePath;

    // Clear undo history when loading a new file (not a reload)
    if (isNewFile) {
      undoRedoManager.clear();
    }

    // Prevent undo recording during scene initialization
    isInitializing = true;
    try {
      if (isReload) {
        const merged = mergeWithCurrentScene(sceneData);
        setScene(merged);
      } else {
        setScene(sceneData);
      }
    } finally {
      // Allow undo recording after initialization completes
      // Use setTimeout to ensure any start callbacks that run synchronously
      // are also covered by the initialization flag
      setTimeout(() => {
        isInitializing = false;
      }, 0);
    }
  } catch (error) {
    console.error("Failed to load scene:", error);
    currentFilePath = filePath;
    isInitializing = false;

    if (hasScene()) {
      return;
    }

    setScene({});
  }
}
