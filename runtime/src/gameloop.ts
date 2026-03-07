type GameCallback = () => void;

type LifecycleRegistry = {
  gameStart: GameCallback[];
  gameUpdate: GameCallback[];
  editorStart: GameCallback[];
  editorUpdate: GameCallback[];
};

const lifecycle: LifecycleRegistry = {
  gameStart: [],
  gameUpdate: [],
  editorStart: [],
  editorUpdate: [],
};

let currentUpdateScope: string | undefined;
const scopeToCallbacks = new Map<string, GameCallback[]>();

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

let gameRunning = false;
let editorRunning = false;

if (import.meta.hot) {
  const data = import.meta.hot.data as {
    gameRunning?: boolean;
    editorRunning?: boolean;
  };

  if (data.gameRunning) gameRunning = true;
  if (data.editorRunning) editorRunning = true;

  import.meta.hot.dispose(() => {
    data.gameRunning = gameRunning;
    data.editorRunning = editorRunning;
  });
}

function registerCallback(list: GameCallback[], callback: GameCallback): void {
  list.push(callback);

  if (import.meta.hot) {
    const data = import.meta.hot.data as {
      callbacks?: { list: GameCallback[]; callback: GameCallback }[];
    };

    if (!data.callbacks) data.callbacks = [];

    data.callbacks.push({ list, callback });

    import.meta.hot.dispose(() => {
      for (const entry of data.callbacks!) {
        const index = entry.list.indexOf(entry.callback);
        if (index !== -1) entry.list.splice(index, 1);
      }
    });
  }
}

export function gameStart(callback: GameCallback): void {
  registerCallback(lifecycle.gameStart, callback);
  callback();
}

export function gameUpdate(callback: GameCallback): void {
  lifecycle.gameUpdate.push(callback);
  if (currentUpdateScope !== undefined) {
    if (!scopeToCallbacks.has(currentUpdateScope)) {
      scopeToCallbacks.set(currentUpdateScope, []);
    }
    scopeToCallbacks.get(currentUpdateScope)!.push(callback);
  }
  if (import.meta.hot) {
    const data = import.meta.hot.data as { callbacks?: { list: GameCallback[]; callback: GameCallback }[] };
    if (!data.callbacks) data.callbacks = [];
    data.callbacks.push({ list: lifecycle.gameUpdate, callback });
    import.meta.hot.dispose(() => {
      for (const entry of data.callbacks!) {
        const index = entry.list.indexOf(entry.callback);
        if (index !== -1) entry.list.splice(index, 1);
      }
    });
  }
}

export function editorStart(callback: GameCallback): void {
  registerCallback(lifecycle.editorStart, callback);
  callback();
}

export function editorUpdate(callback: GameCallback): void {
  registerCallback(lifecycle.editorUpdate, callback);
}

export function startGameloop(): void {
  if (!gameRunning) {
    gameRunning = true;

    function gameFrame(): void {
      for (const update of lifecycle.gameUpdate) update();
      requestAnimationFrame(gameFrame);
    }

    gameFrame();
  }

  if (!editorRunning) {
    editorRunning = true;

    function editorFrame(): void {
      for (const update of lifecycle.editorUpdate) update();
      requestAnimationFrame(editorFrame);
    }

    editorFrame();
  }
}