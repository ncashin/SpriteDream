declare global {
  interface Window {
    gameIDE: {
      __isRunning?: boolean;
    };
  }
}

window.gameIDE = window.gameIDE || {};
window.gameIDE.__isRunning =
  import.meta.env.PROD ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("run") === "true");

type VoidFunction = () => void;
type UpdateFunction = (deltaMilliseconds: number) => void;

const gameUpdateCallbacks: UpdateFunction[] = [];
const editorUpdateCallbacks: UpdateFunction[] = [];

export const gameStart = (callback: VoidFunction): void => {
  if (window.gameIDE.__isRunning) {
    callback();
  }
};

export const gameUpdate = (callback: UpdateFunction): void => {
  if (window.gameIDE.__isRunning) {
    gameUpdateCallbacks.push(callback);
  }
};
export const cleanupGameUpdate = (callback: UpdateFunction): void => {
  const index = gameUpdateCallbacks.indexOf(callback);
  if (index !== -1) gameUpdateCallbacks.splice(index, 1);
};

export const runUpdateLoop = (deltaMilliseconds: number): void => {
  for (const callback of gameUpdateCallbacks) {
    callback(deltaMilliseconds);
  }
};

export const editorStart = (callback: VoidFunction): void => {
  if (!window.gameIDE.__isRunning) {
    callback();
  }
};

export const editorUpdate = (callback: UpdateFunction): void => {
  if (!window.gameIDE.__isRunning) {
    editorUpdateCallbacks.push(callback);
  }
};
export const cleanupEditorUpdate = (callback: UpdateFunction): void => {
  const index = editorUpdateCallbacks.indexOf(callback);
  if (index !== -1) editorUpdateCallbacks.splice(index, 1);
};

export const runEditorUpdateLoop = (deltaMilliseconds: number): void => {
  for (const callback of editorUpdateCallbacks) {
    callback(deltaMilliseconds);
  }
};
