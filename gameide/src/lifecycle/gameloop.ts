import { createCallbackRegistry } from "./callbackRegistry.js";
import { saveSceneSnapshot } from "../scene/snapshot.js";
import { GameIDEMode, getMode, onModeChange } from "./mode.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;

const gameStartRegistry = createCallbackRegistry<StartCallback>();
const gameUpdateRegistry = createCallbackRegistry<UpdateCallback>();

const editorStartRegistry = createCallbackRegistry<StartCallback>();
const editorUpdateRegistry = createCallbackRegistry<UpdateCallback>();

const alwaysStartRegistry = createCallbackRegistry<StartCallback>();
const alwaysUpdateRegistry = createCallbackRegistry<UpdateCallback>();

let frameId: number | undefined;

export function start(callback: StartCallback): void {
  alwaysStartRegistry.register(callback);
}
export function update(callback: UpdateCallback): void {
  alwaysUpdateRegistry.register(callback);
}

export function gameStart(callback: StartCallback): void {
  gameStartRegistry.register(callback);
}
export function gameUpdate(callback: UpdateCallback): void {
  gameUpdateRegistry.register(callback);
}

export function editorStart(callback: StartCallback): void {
  editorStartRegistry.register(callback);
}
export function editorUpdate(callback: UpdateCallback): void {
  editorUpdateRegistry.register(callback);
}

onModeChange((mode) => {
  // Editor → Game: snapshot is taken in setMode() before any listeners, so
  // it cannot include gameStart/always side effects.
  alwaysStartRegistry.run();
  switch (mode) {
    case GameIDEMode.Game:
      gameStartRegistry.run();
      break;
    case GameIDEMode.Editor:
      editorStartRegistry.run();
      break;
    default:
      break;
  }
});

export function startGameloop(): void {
  const initialMode = getMode();
  if (initialMode === GameIDEMode.Game) {
    saveSceneSnapshot();
  }
  alwaysStartRegistry.run();
  switch (initialMode) {
    case GameIDEMode.Game:
      gameStartRegistry.run();
      break;
    case GameIDEMode.Editor:
      editorStartRegistry.run();
      break;
    default:
      break;
  }

  if (frameId !== undefined) return;
  let lastTime = performance.now();

  function tick(now: number): void {
    frameId = requestAnimationFrame(tick);
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    alwaysUpdateRegistry.run(deltaTime);

    switch (getMode()) {
      case GameIDEMode.Game:
        gameUpdateRegistry.run(deltaTime);
        break;
      case GameIDEMode.Editor:
        editorUpdateRegistry.run(deltaTime);
        break;
      default:
        break;
    }
  }

  frameId = requestAnimationFrame(tick);
}
