export enum GameIDEMode {
  Editor = "editor",
  Game = "game",
}

let currentMode: GameIDEMode =
  process.env.NODE_ENV === "development"
    ? GameIDEMode.Editor
    : GameIDEMode.Game;

if (import.meta.hot) {
  const data = import.meta.hot.data;

  if (data.currentMode) currentMode = data.currentMode;

  import.meta.hot.dispose(() => {
    data.currentMode = currentMode;
  });
}

export function getMode(): GameIDEMode {
  return currentMode;
}

type ModeChangeListener = (mode: GameIDEMode, previousMode: GameIDEMode) => void;
const modeChangeListeners: ModeChangeListener[] = [];

export function setMode(mode: GameIDEMode): GameIDEMode {
  const prev = currentMode;
  if (mode === prev) return prev;
  currentMode = mode;
  for (const listener of modeChangeListeners) listener(currentMode, prev);
  return prev;
}


export function onModeChange(listener: ModeChangeListener): () => void {
  modeChangeListeners.push(listener);
  return () => {
    const index = modeChangeListeners.indexOf(listener);
    if (index !== -1) modeChangeListeners.splice(index, 1);
  };
}