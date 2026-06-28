import { GameIDEMode, getMode, onModeChange } from "./mode.js";

function removeCallback<T>(list: T[], item: T) {
  list.splice(list.indexOf(item), 1);
}

// HANDLE START CALLBACKS
type StartCallback = () => void;
type Start = {
  requiredMode?: GameIDEMode;
  callback: StartCallback;
};
const starts: Start[] = [];

function runStarts(entries: readonly Start[], mode: GameIDEMode): void {
  entries.forEach(({ requiredMode, callback }) => {
    if (requiredMode && requiredMode !== mode) return;
    callback();
  });
}

function registerStart(
  requiredMode: GameIDEMode | undefined,
  callback: StartCallback,
): DisposeCallback {
  const start: Start = { requiredMode, callback };
  starts.push(start);
  return () => removeCallback(starts, start);
}

export function onStart(callback: StartCallback): DisposeCallback {
  return registerStart(undefined, callback);
}
export function onGameStart(callback: StartCallback): DisposeCallback {
  return registerStart(GameIDEMode.Game, callback);
}
export function onEditorStart(callback: StartCallback): DisposeCallback {
  return registerStart(GameIDEMode.Editor, callback);
}

// HANDLE UPDATE CALLBACKS
type UpdateCallback = (deltaTime: number) => void;
type Update = {
  requiredMode?: GameIDEMode;
  callback: UpdateCallback;
};
const updates: Update[] = [];

function runUpdates(
  entries: readonly Update[],
  deltaTime: number,
  mode: GameIDEMode,
): void {
  entries.forEach(({ requiredMode, callback }) => {
    if (requiredMode && requiredMode !== mode) return;
    callback(deltaTime);
  });
}

function registerUpdate(
  requiredMode: GameIDEMode | undefined,
  callback: UpdateCallback,
): DisposeCallback {
  const update: Update = { requiredMode, callback };
  updates.push(update);
  return () => removeCallback(updates, update);
}
export function onUpdate(callback: UpdateCallback): DisposeCallback {
  return registerUpdate(undefined, callback);
}
export function onGameUpdate(callback: UpdateCallback): DisposeCallback {
  return registerUpdate(GameIDEMode.Game, callback);
}
export function onEditorUpdate(callback: UpdateCallback): DisposeCallback {
  return registerUpdate(GameIDEMode.Editor, callback);
}

// HANDLE DISPOSE CALLBACKS
export type DisposeCallback = () => void;
const disposeCallbacks: DisposeCallback[] = [];

export function onDispose(callback: () => void): void {
  disposeCallbacks.push(callback);
}

export function flushDisposeCallbacks(): void {
  while (disposeCallbacks.length > 0) {
    const callback = disposeCallbacks.pop();
    callback?.();
  }
}

let frameId: number | undefined;
export function startGameloop(): void {
  if (frameId) return;
  runStarts(starts, getMode());

  let lastTime = performance.now();
  function tick(now: number): void {
    frameId = requestAnimationFrame(tick);
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    runUpdates(updates, deltaTime, getMode());
  }

  frameId = requestAnimationFrame(tick);
}
