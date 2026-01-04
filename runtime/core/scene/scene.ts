import { readFile, writeFile } from "../fileUtilities";

let currentScene: any = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;
const SAVE_DEBOUNCE_MS = 500;

const ARRAY_MUTATION_METHODS = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
];
const DEFAULT_SCENE = {};

function isObject(value: any): boolean {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date)
  );
}

function createPersistentProxy(obj: any, filePath: string): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return new Proxy(obj, {
      set(target: any[], property: string | symbol, value: any): boolean {
        Reflect.set(target, property, value);
        if (typeof property !== "symbol" && !isNaN(Number(property)))
          scheduleSave(filePath);
        return true;
      },
      deleteProperty(target: any[], property: string | symbol): boolean {
        Reflect.deleteProperty(target, property);
        if (typeof property !== "symbol") scheduleSave(filePath);
        return true;
      },
      get(target: any[], property: string | symbol): any {
        const value = Reflect.get(target, property);
        if (
          typeof property === "string" &&
          ARRAY_MUTATION_METHODS.includes(property)
        ) {
          return (...args: any[]) => {
            (value as Function).apply(target, args);
            scheduleSave(filePath);
          };
        }
        return isObject(value) ? createPersistentProxy(value, filePath) : value;
      },
    });
  }
  if (isObject(obj)) {
    return new Proxy(obj, {
      set(target: any, property: string | symbol, value: any): boolean {
        Reflect.set(
          target,
          property,
          isObject(value) ? createPersistentProxy(value, filePath) : value
        );
        scheduleSave(filePath);
        return true;
      },
      deleteProperty(target: any, property: string | symbol): boolean {
        Reflect.deleteProperty(target, property);
        scheduleSave(filePath);
        return true;
      },
      get(target: any, property: string | symbol): any {
        const value = Reflect.get(target, property);
        return isObject(value) ? createPersistentProxy(value, filePath) : value;
      },
    });
  }
  return obj;
}

function scheduleSave(filePath: string): void {
  if (!filePath || !persistenceEnabled) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (currentScene && filePath) {
      try {
        await writeFile(filePath, JSON.stringify(currentScene, null, 2));
      } catch (error) {
        console.error("Failed to save scene:", error);
      }
    }
  }, SAVE_DEBOUNCE_MS);
}

async function initializeScene(
  filePath: string,
  content?: string
): Promise<void> {
  try {
    const sceneContent =
      content !== undefined ? content : await readFile(filePath);
    currentScene = createPersistentProxy(JSON.parse(sceneContent), filePath);
    currentFilePath = filePath;
  } catch (error) {
    console.error("Failed to load scene:", error);
    currentScene = createPersistentProxy(DEFAULT_SCENE, filePath);
    currentFilePath = filePath;
  }
}

export async function setSceneFile(
  filePath: string,
  content?: string
): Promise<void> {
  await initializeScene(filePath, content);
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
