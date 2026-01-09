import {
  getSceneFilePath as getFileHandlerPath,
  setPersistenceEnabled as setFilePersistenceEnabled,
  isPersistenceEnabled as isFilePersistenceEnabled,
  createSaveCallback,
} from "./sceneFileHandler";

export type SceneData = Record<string, unknown>;

let currentScene: SceneData | null = null;
let saveCallback: ((sceneData: SceneData) => void) | null = null;

const DEFAULT_SCENE: SceneData = {};
const ARRAY_MUTATION_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date);
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
      const newValue = isObject(value) ? createPersistentProxy(value, onSave) : value;
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
      
      if (Array.isArray(target) && typeof property === "string" && ARRAY_MUTATION_METHODS.includes(property as typeof ARRAY_MUTATION_METHODS[number])) {
        return (...args: unknown[]) => {
          const result = (value as (...args: unknown[]) => unknown).apply(target, args);
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

function mergeSceneData(existing: SceneData | null, incoming: SceneData): SceneData {
  if (!existing) return deepClone(incoming);
  return mergeObjects(existing, incoming);
}

export function mergeWithCurrentScene(incoming: SceneData): SceneData {
  return mergeSceneData(currentScene, incoming);
}

export function setScene(sceneData: SceneData): void {
  const filePath = getFileHandlerPath();
  if (filePath) {
    saveCallback = createSaveCallback(filePath);
  } else {
    // If no file path, create a no-op save callback
    saveCallback = () => {};
  }
  currentScene = createPersistentProxy(deepClone(sceneData), saveCallback);
}

export function hasScene(): boolean {
  return currentScene !== null;
}

export function getScene(): SceneData {
  if (!currentScene) {
    const filePath = getFileHandlerPath() || "";
    saveCallback = createSaveCallback(filePath);
    currentScene = createPersistentProxy(DEFAULT_SCENE, saveCallback);
  }
  return currentScene;
}

export function getSceneFilePath(): string | null {
  return getFileHandlerPath();
}

export function setPersistenceEnabled(enabled: boolean): void {
  setFilePersistenceEnabled(enabled);
}

export function isPersistenceEnabled(): boolean {
  return isFilePersistenceEnabled();
}

export function saveSceneSnapshot(): SceneData | null {
  return currentScene ? deepClone(currentScene) : null;
}

export async function restoreSceneFromSnapshot(snapshot: SceneData): Promise<void> {
  const filePath = getFileHandlerPath();
  if (!snapshot || !filePath) return;
  saveCallback = createSaveCallback(filePath);
  currentScene = createPersistentProxy(deepClone(snapshot), saveCallback);
}
