import { readFile, writeFile } from "../fileUtilities";

let currentScene: any = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;
const SAVE_DEBOUNCE_MS = 500;
const DEFAULT_SCENE = {};

function isObject(value: any): boolean {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function createPersistentProxy(obj: any, filePath: string): any {
  if (!isObject(obj)) return obj;

  const arrayMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];

  return new Proxy(obj, {
    set(target: any, property: string | symbol, value: any): boolean {
      const newValue = isObject(value) ? createPersistentProxy(value, filePath) : value;
      Reflect.set(target, property, newValue);
      
      if (typeof property !== "symbol" && property !== "length") {
        scheduleSave(filePath);
      }
      return true;
    },

    deleteProperty(target: any, property: string | symbol): boolean {
      Reflect.deleteProperty(target, property);
      if (typeof property !== "symbol") {
        scheduleSave(filePath);
      }
      return true;
    },

    get(target: any, property: string | symbol): any {
      const value = Reflect.get(target, property);
      
      if (Array.isArray(target) && typeof property === "string" && arrayMethods.includes(property)) {
        return (...args: any[]) => {
          const result = (value as Function).apply(target, args);
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

function mergeSceneData(existing: any, incoming: any): any {
  if (!existing) return JSON.parse(JSON.stringify(incoming));
  if (!incoming) return JSON.parse(JSON.stringify(existing));

  const merged = JSON.parse(JSON.stringify(existing));

  if (incoming.ecs?.componentPools) {
    if (!merged.ecs) merged.ecs = { componentPools: {} };
    if (!merged.ecs.componentPools) merged.ecs.componentPools = {};

    const existingPools = merged.ecs.componentPools;
    const newPools = incoming.ecs.componentPools;

    for (const componentType in newPools) {
      if (!existingPools[componentType]) {
        existingPools[componentType] = JSON.parse(JSON.stringify(newPools[componentType]));
      } else {
        for (const entityId in newPools[componentType]) {
          if (!existingPools[componentType][entityId]) {
            existingPools[componentType][entityId] = JSON.parse(JSON.stringify(newPools[componentType][entityId]));
          } else {
            const existing = existingPools[componentType][entityId];
            const incoming = newPools[componentType][entityId];
            for (const prop in incoming) {
              if (!(prop in existing)) {
                existing[prop] = incoming[prop];
              }
            }
          }
        }
      }
    }
  }

  for (const key in incoming) {
    if (key !== 'ecs' && !(key in merged)) {
      merged[key] = JSON.parse(JSON.stringify(incoming[key]));
    }
  }

  return merged;
}

async function loadScene(filePath: string, content?: string, isReload: boolean = false): Promise<void> {
  try {
    const fileContent = content !== undefined ? content : await readFile(filePath);
    const sceneData = JSON.parse(fileContent);

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

export function getScene(): any {
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

export function saveSceneSnapshot(): any {
  return currentScene ? JSON.parse(JSON.stringify(currentScene)) : null;
}

export async function restoreSceneFromSnapshot(snapshot: any): Promise<void> {
  if (!snapshot || !currentFilePath) return;
  currentScene = createPersistentProxy(
    JSON.parse(JSON.stringify(snapshot)),
    currentFilePath
  );
}
