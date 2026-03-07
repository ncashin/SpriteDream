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
  registerCallback(lifecycle.gameUpdate, callback);
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