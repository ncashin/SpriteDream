import { readFile, writeFile } from "../fileUtilities";

type SceneData = Record<string, unknown>;

let currentScene: SceneData | null = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;

const SAVE_DEBOUNCE_MS = 500;
const DEFAULT_SCENE: SceneData = {};
const ARRAY_MUTATION_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function createPersistentProxy<T extends Record<string, unknown>>(obj: T, filePath: string): T {
  if (!isObject(obj)) return obj;

  return new Proxy(obj, {
    set(target: T, property: string | symbol, value: unknown): boolean {
      const newValue = isObject(value) ? createPersistentProxy(value, filePath) : value;
      Reflect.set(target, property, newValue);
      
      if (typeof property !== "symbol" && property !== "length") {
        scheduleSave(filePath);
      }
      return true;
    },

    deleteProperty(target: T, property: string | symbol): boolean {
      Reflect.deleteProperty(target, property);
      if (typeof property !== "symbol") {
        scheduleSave(filePath);
      }
      return true;
    },

    get(target: T, property: string | symbol): unknown {
      const value = Reflect.get(target, property);
      
      if (Array.isArray(target) && typeof property === "string" && ARRAY_MUTATION_METHODS.includes(property as typeof ARRAY_MUTATION_METHODS[number])) {
        return (...args: unknown[]) => {
          const result = (value as (...args: unknown[]) => unknown).apply(target, args);
          scheduleSave(filePath);
          return result;
        };
      }
      
      return isObject(value) ? createPersistentProxy(value, filePath) : value;
    },
  });
}

function scheduleSave(filePath: string): void {
  if (!filePath || !persistenceEnabled || !currentScene) return;
  
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(async () => {
    try {
      await writeFile(filePath, JSON.stringify(currentScene, null, 2));
    } catch (error) {
      console.error("Failed to save scene:", error);
    }
  }, SAVE_DEBOUNCE_MS);
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

async function loadScene(filePath: string, content?: string, isReload: boolean = false): Promise<void> {
  try {
    if (content === undefined) {
      const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
      if (!isDev) {
        throw new Error("Scene content must be provided in production mode");
      }
      content = await readFile(filePath);
    }
    
    const sceneData = JSON.parse(content) as SceneData;

    if (isReload && currentScene && currentFilePath === filePath) {
      const merged = mergeSceneData(currentScene, sceneData);
      currentScene = createPersistentProxy(merged, filePath);
    } else {
      currentScene = createPersistentProxy(sceneData, filePath);
    }
    
    currentFilePath = filePath;
  } catch (error) {
    console.error("Failed to load scene:", error);
    
    if (isReload && currentScene && currentFilePath === filePath) {
      console.warn("Reload failed, keeping existing runtime state");
    } else {
      currentScene = createPersistentProxy(DEFAULT_SCENE, filePath);
      currentFilePath = filePath;
    }
  }
}

export async function setSceneFile(filePath: string, content?: string): Promise<void> {
  const isReload = currentScene !== null && currentFilePath === filePath;
  await loadScene(filePath, content, isReload);
}

export function getScene(): SceneData {
  if (!currentScene) {
    currentScene = createPersistentProxy(DEFAULT_SCENE, currentFilePath || "");
  }
  return currentScene;
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

export function saveSceneSnapshot(): SceneData | null {
  return currentScene ? deepClone(currentScene) : null;
}

export async function restoreSceneFromSnapshot(snapshot: SceneData): Promise<void> {
  if (!snapshot || !currentFilePath) return;
  currentScene = createPersistentProxy(deepClone(snapshot), currentFilePath);
}
