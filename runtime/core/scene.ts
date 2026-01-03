import { readFile, writeFile } from './fileUtilities';

let currentScene: any = null;
let currentFilePath: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let persistenceEnabled = true;
const SAVE_DEBOUNCE_MS = 500;

function createPersistentProxy(obj: any, filePath: string): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return new Proxy(obj, {
            set(target: any[], property: string | symbol, value: any): boolean {
                const result = Reflect.set(target, property, value);
                if (typeof property !== 'symbol' && !isNaN(Number(property))) {
                    scheduleSave(filePath);
                }
                return result;
            },
            deleteProperty(target: any[], property: string | symbol): boolean {
                const result = Reflect.deleteProperty(target, property);
                if (typeof property !== 'symbol') {
                    scheduleSave(filePath);
                }
                return result;
            },
            get(target: any[], property: string | symbol): any {
                const value = Reflect.get(target, property);
                
                if (typeof property === 'string' && 
                    ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(property)) {
                    return (...args: any[]) => {
                        const result = (value as Function).apply(target, args);
                        scheduleSave(filePath);
                        return result;
                    };
                }
                
                if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                    return createPersistentProxy(value, filePath);
                }
                
                return value;
            }
        });
    }

    if (typeof obj === 'object' && !(obj instanceof Date)) {
        return new Proxy(obj, {
            set(target: any, property: string | symbol, value: any): boolean {
                if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                    value = createPersistentProxy(value, filePath);
                }
                
                const result = Reflect.set(target, property, value);
                scheduleSave(filePath);
                return result;
            },
            deleteProperty(target: any, property: string | symbol): boolean {
                const result = Reflect.deleteProperty(target, property);
                scheduleSave(filePath);
                return result;
            },
            get(target: any, property: string | symbol): any {
                const value = Reflect.get(target, property);
                
                if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                    return createPersistentProxy(value, filePath);
                }
                
                return value;
            }
        });
    }

    return obj;
}

function scheduleSave(filePath: string): void {
    if (!filePath || !persistenceEnabled) {
        return;
    }
    
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
        if (currentScene && filePath) {
            try {
                const jsonContent = JSON.stringify(currentScene, null, 2);
                await writeFile(filePath, jsonContent);
            } catch (error) {
                console.error('Failed to save scene:', error);
            }
        }
    }, SAVE_DEBOUNCE_MS);
}

async function initializeScene(filePath: string, content?: string): Promise<void> {
    try {
        let sceneContent: string;
        
        if (content !== undefined) {
            sceneContent = content;
        } else {
            sceneContent = await readFile(filePath);
        }
        
        currentScene = JSON.parse(sceneContent);
        currentFilePath = filePath;
        
        currentScene = createPersistentProxy(currentScene, filePath);
    } catch (error) {
        console.error('Failed to load scene:', error);
        currentScene = createPersistentProxy({
            gameState: {},
            ecs: {
                entities: [],
                systems: []
            }
        }, filePath);
        currentFilePath = filePath;
    }
}

export async function setSceneFile(filePath: string, content?: string): Promise<void> {
    await initializeScene(filePath, content);
}

export function getScene(): any {
    if (!currentScene) {
        currentScene = createPersistentProxy({
            gameState: {},
            ecs: {
                entities: [],
                systems: []
            }
        }, currentFilePath || '');
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
    if (!currentScene) {
        return null;
    }
    // Create a deep copy of the scene without the proxy
    return JSON.parse(JSON.stringify(currentScene));
}

export async function restoreSceneFromSnapshot(snapshot: any): Promise<void> {
    if (!snapshot || !currentFilePath) {
        return;
    }
    
    // Restore the scene from snapshot
    currentScene = JSON.parse(JSON.stringify(snapshot));
    currentScene = createPersistentProxy(currentScene, currentFilePath);
}

