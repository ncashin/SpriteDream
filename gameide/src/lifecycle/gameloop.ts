import { createCallbackRegistry } from "./callbackRegistry.js";
import { GameIDEMode, getMode } from "./mode.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;

const gameStartRegistry = createCallbackRegistry<StartCallback>();
const gameUpdateRegistry = createCallbackRegistry<UpdateCallback>();

const editorStartRegistry = createCallbackRegistry<StartCallback>();
const editorUpdateRegistry = createCallbackRegistry<UpdateCallback>();

const alwaysStartRegistry = createCallbackRegistry<StartCallback>();
const alwaysUpdateRegistry = createCallbackRegistry<UpdateCallback>();

let frameId: number | undefined;

/** Clears all lifecycle registrations (starts and updates). Used before re-running plugins + main. */
export function resetLifecycle(): void {
  gameStartRegistry.clear();
  gameUpdateRegistry.clear();
  editorStartRegistry.clear();
  editorUpdateRegistry.clear();
  alwaysStartRegistry.clear();
  alwaysUpdateRegistry.clear();
}

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

/** Runs registered start callbacks for the current mode (always + mode-specific). */
export function runStartsForCurrentMode(): void {
  alwaysStartRegistry.run();
  switch (getMode()) {
    case GameIDEMode.Game:
      gameStartRegistry.run();
      break;
    case GameIDEMode.Editor:
      editorStartRegistry.run();
      break;
    default:
      break;
  }
}

export function startGameloop(): void {
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
