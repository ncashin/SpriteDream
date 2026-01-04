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

/**
 * Deep merges a new scene file into the existing runtime scene.
 * Preserves all existing runtime state while incorporating new entities/components from the file.
 */
function mergeSceneData(existingScene: any, newSceneData: any): any {
  if (!existingScene) return newSceneData;
  if (!newSceneData) return existingScene;

  const merged = JSON.parse(JSON.stringify(existingScene));

  // Merge ECS component pools if they exist
  if (newSceneData.ecs?.componentPools && merged.ecs?.componentPools) {
    const existingPools = merged.ecs.componentPools;
    const newPools = newSceneData.ecs.componentPools;

    // For each component type in the new file
    for (const componentType in newPools) {
      if (!existingPools[componentType]) {
        // New component type - add it entirely
        existingPools[componentType] = JSON.parse(JSON.stringify(newPools[componentType]));
      } else {
        // Component type exists - merge entities
        const existingEntities = existingPools[componentType];
        const newEntities = newPools[componentType];

        // For each entity in the new file
        for (const entityId in newEntities) {
          if (!existingEntities[entityId]) {
            // New entity - add it entirely
            existingEntities[entityId] = JSON.parse(JSON.stringify(newEntities[entityId]));
          } else {
            // Entity exists in both - merge component properties
            // Keep runtime values for existing properties, add new properties from file
            const existingComponent = existingEntities[entityId];
            const newComponent = newEntities[entityId];
            
            // Ensure type property is set (required for components)
            if (newComponent.type && !existingComponent.type) {
              existingComponent.type = newComponent.type;
            }
            
            for (const prop in newComponent) {
              // Only add properties that don't exist in runtime (preserve runtime state)
              if (!(prop in existingComponent)) {
                existingComponent[prop] = newComponent[prop];
              }
            }
          }
        }
      }
    }
  } else if (newSceneData.ecs?.componentPools && !merged.ecs) {
    // New scene has ECS data but runtime doesn't - initialize it
    merged.ecs = {
      componentPools: JSON.parse(JSON.stringify(newSceneData.ecs.componentPools))
    };
  } else if (newSceneData.ecs?.componentPools && !merged.ecs.componentPools) {
    // Runtime has ecs but no componentPools - add them
    merged.ecs.componentPools = JSON.parse(JSON.stringify(newSceneData.ecs.componentPools));
  }

  // Merge any other top-level properties (non-ECS data)
  for (const key in newSceneData) {
    if (key !== 'ecs' && !(key in merged)) {
      merged[key] = JSON.parse(JSON.stringify(newSceneData[key]));
    }
  }

  return merged;
}

async function initializeScene(
  filePath: string,
  content?: string,
  isReload: boolean = false
): Promise<void> {
  try {
    const sceneContent =
      content !== undefined ? content : await readFile(filePath);
    const newSceneData = JSON.parse(sceneContent);

    // If this is a reload of the same file and we have existing scene data, merge instead of replace
    if (isReload && currentScene && currentFilePath === filePath) {
      const mergedData = mergeSceneData(currentScene, newSceneData);
      // Recreate proxy with merged data
      currentScene = createPersistentProxy(mergedData, filePath);
    } else {
      // First load or different file - replace entirely
      currentScene = createPersistentProxy(newSceneData, filePath);
    }
    currentFilePath = filePath;
  } catch (error) {
    console.error("Failed to load scene:", error);
    if (isReload && currentScene && currentFilePath === filePath) {
      // On error during reload, keep existing scene
      console.warn("Failed to reload scene file, keeping existing runtime state");
    } else {
      currentScene = createPersistentProxy(DEFAULT_SCENE, filePath);
      currentFilePath = filePath;
    }
  }
}

export async function setSceneFile(
  filePath: string,
  content?: string
): Promise<void> {
  // Check if this is a reload of the same file while game is running
  const isReload = currentScene !== null && currentFilePath === filePath;
  await initializeScene(filePath, content, isReload);
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
