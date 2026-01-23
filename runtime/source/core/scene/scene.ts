import { writeFile, readFile } from "../fileUtilities";
import { isDevelopment, isEditorMode } from "../utils";

export type SceneData = Record<string, unknown>;

let currentScene: SceneData | null = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;
let sceneSnapshot: SceneData | null = null;

const DEFAULT_SCENE: SceneData = {};
const SAVE_DEBOUNCE_MS = 500;
const ARRAY_MUTATION_METHODS = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date)
  );
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function createPersistentProxy<T extends Record<string, unknown>>(
  obj: T,
  onSave: (sceneData: SceneData) => void
): T {
  if (!isObject(obj)) return obj;

  return new Proxy(obj, {
    set(target: T, property: string | symbol, value: unknown): boolean {
      const newValue = isObject(value)
        ? createPersistentProxy(value, onSave)
        : value;
      Reflect.set(target, property, newValue);

      if (typeof property !== "symbol" && property !== "length") {
        onSave(currentScene!);
      }
      return true;
    },

    deleteProperty(target: T, property: string | symbol): boolean {
      Reflect.deleteProperty(target, property);
      if (typeof property !== "symbol") {
        onSave(currentScene!);
      }
      return true;
    },

    get(target: T, property: string | symbol): unknown {
      const value = Reflect.get(target, property);

      if (
        Array.isArray(target) &&
        typeof property === "string" &&
        ARRAY_MUTATION_METHODS.includes(
          property as (typeof ARRAY_MUTATION_METHODS)[number]
        )
      ) {
        return (...args: unknown[]) => {
          const result = (value as (...args: unknown[]) => unknown).apply(
            target,
            args
          );
          onSave(currentScene!);
          return result;
        };
      }

      return isObject(value) ? createPersistentProxy(value, onSave) : value;
    },
  });
}

function mergeObjects(existing: SceneData, incoming: SceneData): SceneData {
  const merged = deepClone(existing);

  for (const key in incoming) {
    const incomingValue = incoming[key];
    const existingValue = merged[key];

    if (isObject(incomingValue) && isObject(existingValue)) {
      merged[key] = mergeObjects(existingValue, incomingValue);
    } else {
      merged[key] = deepClone(incomingValue);
    }
  }

  for (const key in merged) {
    if (!(key in incoming)) {
      delete merged[key];
    }
  }

  return merged;
}

function mergeSceneData(
  existing: SceneData | null,
  incoming: SceneData
): SceneData {
  if (!existing) return deepClone(incoming);
  return mergeObjects(existing, incoming);
}

export function mergeWithCurrentScene(incoming: SceneData): SceneData {
  return mergeSceneData(currentScene, incoming);
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

  try {
    function applyDiffRecursive(
      target: SceneData,
      diff: SceneData
    ): void {
      for (const key in diff) {
        const diffValue = diff[key];
        const targetValue = target[key];

        if (isObject(diffValue) && isObject(targetValue)) {
          applyDiffRecursive(targetValue as SceneData, diffValue as SceneData);
        } else {
          target[key] = deepClone(diffValue);
        }
      }
    }

    applyDiffRecursive(currentScene, diff);

    if (sceneSnapshot) {
      applyDiffRecursive(sceneSnapshot, diff);
    }
  } finally {
    persistenceEnabled = wasPersistenceEnabled;
  }
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
  const parsedData: SceneData =
    typeof sceneData === "string" ? JSON.parse(sceneData) : sceneData;
  const onSave = currentFilePath
    ? (data: SceneData) => saveScene(currentFilePath!, data)
    : () => { };
  currentScene = createPersistentProxy(deepClone(parsedData), onSave);
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

export function saveSceneSnapshot() {
  sceneSnapshot = currentScene ? deepClone(currentScene) : null;
}

export async function restoreSceneFromSnapshot(): Promise<void> {
  if (!sceneSnapshot) return;
  const onSave = currentFilePath
    ? (data: SceneData) => saveScene(currentFilePath!, data)
    : () => { };
  currentScene = createPersistentProxy(deepClone(sceneSnapshot), onSave);
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
    currentFilePath = filePath;

    if (isReload) {
      const merged = mergeWithCurrentScene(sceneData);
      setScene(merged);
      return;
    }

    setScene(sceneData);
  } catch (error) {
    console.error("Failed to load scene:", error);
    currentFilePath = filePath;

    if (hasScene()) {
      return;
    }

    setScene({});
  }
}
