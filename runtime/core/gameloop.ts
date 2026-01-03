
export type CallbackId = number;

const updateCallbacks: Record<CallbackId, (deltaTime: number) => void> = {};
const drawCallbacks: Record<CallbackId, () => void> = {};
const editorCallbacks: Record<CallbackId, () => void> = {};

let nextCallbackId = 1;

export let updateEnabled = false;
export let drawEnabled = true;
export let editorEnabled = true;

export const setUpdateEnabled = (enabled: boolean) => { updateEnabled = enabled; };
export const setDrawEnabled = (enabled: boolean) => { drawEnabled = enabled; };
export const setEditorEnabled = (enabled: boolean) => { editorEnabled = enabled; };

export const isUpdateEnabled = () => updateEnabled;
export const isDrawEnabled = () => drawEnabled;
export const isEditorEnabled = () => editorEnabled;

export const addUpdateCallback = (callback: (deltaTime: number) => void): CallbackId => {
    const id = nextCallbackId++;
    updateCallbacks[id] = callback;
    return id;
};

export const removeUpdateCallback = (id: CallbackId): boolean => {
    if (id in updateCallbacks) {
        delete updateCallbacks[id];
        return true;
    }
    return false;
};

export const addDrawCallback = (callback: () => void): CallbackId => {
    const id = nextCallbackId++;
    drawCallbacks[id] = callback;
    return id;
};

export const removeDrawCallback = (id: CallbackId): boolean => {
    if (id in drawCallbacks) {
        delete drawCallbacks[id];
        return true;
    }
    return false;
};

export const addEditorCallback = (callback: () => void): CallbackId => {
    const id = nextCallbackId++;
    editorCallbacks[id] = callback;
    return id;
};

export const removeEditorCallback = (id: CallbackId): boolean => {
    if (id in editorCallbacks) {
        delete editorCallbacks[id];
        return true;
    }
    return false;
};

let lastTime = performance.now();

const gameloop = (currentTime: number) => {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const clampedDelta = Math.min(deltaTime, 0.1);
    
    if (updateEnabled) {
        for (const callback of Object.values(updateCallbacks)) {
            callback(clampedDelta);
        }
    }
    if (drawEnabled) {
        for (const callback of Object.values(drawCallbacks)) {
            callback();
        }
    }
    if (editorEnabled) {
        for (const callback of Object.values(editorCallbacks)) {
            callback();
        }
    }
    requestAnimationFrame(gameloop);
}

// Start the gameloop
requestAnimationFrame(gameloop);

