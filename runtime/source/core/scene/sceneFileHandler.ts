import { readFile, writeFile } from "../fileUtilities";
import { setScene, mergeWithCurrentScene, hasScene, type SceneData } from "./scene";

let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;

const SAVE_DEBOUNCE_MS = 500;

export function getSceneFilePath(): string | null {
  return currentFilePath;
}

export function setSceneFilePath(filePath: string | null): void {
  currentFilePath = filePath;
}

export function setPersistenceEnabled(enabled: boolean): void {
  persistenceEnabled = enabled;
}

export function isPersistenceEnabled(): boolean {
  return persistenceEnabled;
}

export function createSaveCallback(filePath: string): (sceneData: SceneData) => void {
  return (sceneData: SceneData) => {
    scheduleSave(filePath, sceneData);
  };
}

function scheduleSave(filePath: string, sceneData: SceneData): void {
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

export async function loadSceneFromFile(filePath: string, content?: string): Promise<SceneData> {
  try {
    if (content === undefined) {
      const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
      if (!isDev) {
        throw new Error("Scene content must be provided in production mode");
      }
      content = await readFile(filePath);
    }
    
    const sceneData = JSON.parse(content) as SceneData;
    currentFilePath = filePath;
    return sceneData;
  } catch (error) {
    console.error("Failed to load scene:", error);
    currentFilePath = filePath;
    throw error;
  }
}

export async function setSceneFile(filePath: string, content?: string): Promise<void> {
  try {
    const sceneData = await loadSceneFromFile(filePath, content);
    const filePathMatches = currentFilePath === filePath;
    const isReload = filePathMatches && hasScene();

    if (isReload) {
      const merged = mergeWithCurrentScene(sceneData);
      setScene(merged);
    } else {
      setScene(sceneData);
    }
    
    currentFilePath = filePath;
  } catch (error) {
    console.error("Failed to load scene:", error);
    
    const filePathMatches = currentFilePath === filePath;
    if (filePathMatches && hasScene()) {
      console.warn("Reload failed, keeping existing runtime state");
    } else {
      setScene({});
      currentFilePath = filePath;
    }
  }
}

