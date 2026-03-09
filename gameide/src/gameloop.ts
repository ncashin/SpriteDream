type GameCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;

type LifecycleRegistry = {
  gameStart: GameCallback[];
  gameUpdate: UpdateCallback[];
  editorStart: GameCallback[];
  editorUpdate: UpdateCallback[];
  alwaysUpdate: UpdateCallback[];
};

const lifecycle: LifecycleRegistry = {
  gameStart: [],
  gameUpdate: [],
  editorStart: [],
  editorUpdate: [],
  alwaysUpdate: [],
};

let currentUpdateScope: string | undefined;
const scopeToCallbacks = new Map<string, UpdateCallback[]>();

export function setUpdateScope(scope: string): void {
  currentUpdateScope = scope;
}

export function clearUpdateScope(): void {
  currentUpdateScope = undefined;
}

export function removeGameUpdatesForScope(scope: string): void {
  const callbacks = scopeToCallbacks.get(scope);
  if (callbacks) {
    for (const cb of callbacks) {
      const i = lifecycle.gameUpdate.indexOf(cb);
      if (i !== -1) lifecycle.gameUpdate.splice(i, 1);
    }
    scopeToCallbacks.delete(scope);
  }
}

type RunMode = "editor" | "game";
let runMode: RunMode = "editor";
let frameId: number | undefined;

if (typeof import.meta !== "undefined" && import.meta.hot) {
  const data = import.meta.hot.data as { runMode?: RunMode };
  if (data.runMode) runMode = data.runMode;
  import.meta.hot.dispose(() => {
    data.runMode = runMode;
  });
}

function registerCallback(list: GameCallback[], callback: GameCallback): void;
function registerCallback(
  list: UpdateCallback[],
  callback: UpdateCallback,
): void;
function registerCallback(
  list: GameCallback[] | UpdateCallback[],
  callback: GameCallback | UpdateCallback,
): void {
  (list as (GameCallback | UpdateCallback)[]).push(callback);

  if (typeof import.meta !== "undefined" && import.meta.hot) {
    const data = import.meta.hot.data as {
      callbacks?: {
        list: (GameCallback | UpdateCallback)[];
        callback: GameCallback | UpdateCallback;
      }[];
    };

    if (!data.callbacks) data.callbacks = [];

    data.callbacks.push({ list, callback });

    import.meta.hot.dispose(() => {
      for (const entry of data.callbacks!) {
        const index = entry.list.indexOf(
          entry.callback as GameCallback & UpdateCallback,
        );
        if (index !== -1) entry.list.splice(index, 1);
      }
    });
  }
}

export function gameStart(callback: GameCallback): void {
  registerCallback(lifecycle.gameStart, callback);
}

export function gameUpdate(callback: UpdateCallback): void {
  lifecycle.gameUpdate.push(callback);

  if (currentUpdateScope !== undefined) {
    if (!scopeToCallbacks.has(currentUpdateScope)) {
      scopeToCallbacks.set(currentUpdateScope, []);
    }
    const callbacks = scopeToCallbacks.get(currentUpdateScope);
    if (Array.isArray(callbacks)) {
      callbacks.push(callback);
    }
  }

  if (import.meta.hot) {
    let data = import.meta.hot.data as {
      callbacks?: { list: UpdateCallback[]; callback: UpdateCallback }[];
    };

    if (!data.callbacks) data.callbacks = [];
    data.callbacks.push({ list: lifecycle.gameUpdate, callback });

    import.meta.hot.dispose(() => {
      for (const entry of data.callbacks!) {
        if (Array.isArray(entry.list) && entry.callback) {
          const index = entry.list.indexOf(entry.callback);
          if (index !== -1) entry.list.splice(index, 1);
        }
      }
    });
  }
}

export function editorStart(callback: GameCallback): void {
  registerCallback(lifecycle.editorStart, callback);
}

export function editorUpdate(callback: UpdateCallback): void {
  registerCallback(lifecycle.editorUpdate, callback);
}

export function update(callback: UpdateCallback): void {
  registerCallback(lifecycle.alwaysUpdate, callback);
}

function runEditorStartCallbacks(): void {
  for (const cb of lifecycle.editorStart) cb();
}

function runGameStartCallbacks(): void {
  for (const cb of lifecycle.gameStart) cb();
}

export function setGameRunning(running: boolean): void {
  const nextMode: RunMode = running ? "game" : "editor";
  if (runMode === nextMode) return;
  runMode = nextMode;
  if (running) {
    runGameStartCallbacks();
  } else {
    runEditorStartCallbacks();
  }
}

export function isGameRunning(): boolean {
  return runMode === "game";
}

export function startGameloop(): void {
  runEditorStartCallbacks();
  if (frameId !== undefined) return;
  let lastTime = performance.now();

  function tick(now: number): void {
    frameId = requestAnimationFrame(tick);
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;
    for (const update of lifecycle.alwaysUpdate) update(deltaTime);
    if (runMode === "game") {
      for (const update of lifecycle.gameUpdate) update(deltaTime);
    } else {
      for (const update of lifecycle.editorUpdate) update(deltaTime);
    }
  }

  frameId = requestAnimationFrame(tick);
}
