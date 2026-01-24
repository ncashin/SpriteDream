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
  try {
    let parsedData: SceneData =
      typeof sceneData === "string" ? JSON.parse(sceneData) : sceneData;

    // Validate parsed data
    if (typeof parsedData !== "object" || parsedData === null || Array.isArray(parsedData)) {
      console.warn("Invalid scene data, using default scene");
      parsedData = DEFAULT_SCENE;
    }

    const onSave = currentFilePath
      ? (data: SceneData) => saveScene(currentFilePath!, data)
      : () => { };
    currentScene = createPersistentProxy(deepClone(parsedData), onSave);
  } catch (error) {
    console.error("Failed to set scene:", error);
    // Fallback to default scene
    const onSave = currentFilePath
      ? (data: SceneData) => saveScene(currentFilePath!, data)
      : () => { };
    currentScene = createPersistentProxy(DEFAULT_SCENE, onSave);
  }
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

  // Validate scene structure to prevent corruption
  if (typeof currentScene !== "object" || currentScene === null || Array.isArray(currentScene)) {
    console.warn("Scene state corrupted, resetting to default");
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

// HMR: Preserve scene data across hot updates
// Note: The snapshot is preserved but NOT restored during HMR.
// The snapshot is only restored when the user clicks "Stop" in the editor.
// During HMR, we preserve the current running scene state (currentScene),
// not the snapshot, so the game continues running with its current state.
if (import.meta.hot) {
  // Preserve scene state on dispose
  import.meta.hot.dispose((data) => {
    try {
      if (currentScene) {
        data.currentScene = deepClone(currentScene);
      }
      if (currentFilePath) {
        data.currentFilePath = currentFilePath;
      }
      if (sceneSnapshot) {
        data.sceneSnapshot = deepClone(sceneSnapshot);
      }
      data.persistenceEnabled = persistenceEnabled;
    } catch (error) {
      console.error("Failed to preserve scene state during HMR:", error);
      // Try to preserve at least the file path
      if (currentFilePath) {
        data.currentFilePath = currentFilePath;
      }
    }
  });

  // Restore scene state on reload
  const hotData = import.meta.hot.data;
  if (hotData) {
    try {
      // Restore currentScene (running state), not snapshot
      if (hotData.currentScene) {
        const onSave = hotData.currentFilePath
          ? (sceneData: SceneData) => saveScene(hotData.currentFilePath, sceneData)
          : () => { };
        currentScene = createPersistentProxy(deepClone(hotData.currentScene), onSave);
      } else if (hotData.currentFilePath) {
        // If we have a file path but no scene data, ensure we have at least an empty scene
        // This prevents plugins from failing during initialization
        const onSave = (sceneData: SceneData) => saveScene(hotData.currentFilePath, sceneData);
        currentScene = createPersistentProxy(DEFAULT_SCENE, onSave);
      }

      if (hotData.currentFilePath) {
        currentFilePath = hotData.currentFilePath;
      }

      // Preserve snapshot but don't restore it - only restore on Stop button
      if (hotData.sceneSnapshot) {
        sceneSnapshot = deepClone(hotData.sceneSnapshot);
      }

      if (hotData.persistenceEnabled !== undefined) {
        persistenceEnabled = hotData.persistenceEnabled;
      }
    } catch (error) {
      console.error("Failed to restore scene state during HMR:", error);
      // Fallback: ensure we have at least a valid scene structure
      if (!currentScene && hotData.currentFilePath) {
        const onSave = (sceneData: SceneData) => saveScene(hotData.currentFilePath, sceneData);
        currentScene = createPersistentProxy(DEFAULT_SCENE, onSave);
        currentFilePath = hotData.currentFilePath;
      }
    }
  }
}
