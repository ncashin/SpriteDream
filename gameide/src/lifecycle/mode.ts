import { saveSceneSnapshot } from "../scene/snapshot.js";

export enum GameIDEMode {
  Editor = "editor",
  Game = "game",
}

let currentMode: GameIDEMode =
  process.env.NODE_ENV === "development"
    ? GameIDEMode.Editor
    : GameIDEMode.Game;

export function getMode(): GameIDEMode {
  return currentMode;
}

type ModeChangeListener = (mode: GameIDEMode, previousMode: GameIDEMode) => void;
const modeChangeListeners: ModeChangeListener[] = [];

export function setMode(mode: GameIDEMode): GameIDEMode {
  const prev = currentMode;
  if (mode === prev) return prev;
  if (prev === GameIDEMode.Editor && mode === GameIDEMode.Game) {
    saveSceneSnapshot();
  }
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