import { createCallbackRegistry } from "./callbackRegistry.js";
import { GameIDEMode, getMode, onModeChange } from "./mode.js";
import { getRootTarget, replaceScene } from "./scene.js";
import type { SceneObject } from "./scene.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;

let currentUpdateScope: string | undefined;

const gameStartRegistry = createCallbackRegistry<StartCallback>();
const gameUpdateRegistry = createCallbackRegistry<UpdateCallback>({
  getCurrentScope: () => currentUpdateScope,
});
const editorStartRegistry = createCallbackRegistry<StartCallback>();
const editorUpdateRegistry = createCallbackRegistry<UpdateCallback>();
const alwaysUpdateRegistry = createCallbackRegistry<UpdateCallback>();

export function setUpdateScope(scope: string): void {
  currentUpdateScope = scope;
}

export function clearUpdateScope(): void {
  currentUpdateScope = undefined;
}

export function removeGameUpdatesForScope(scope: string): void {
  gameUpdateRegistry.removeScope(scope);
}

let frameId: number | undefined;

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

let sceneSnapshotBeforeGame: SceneObject | undefined;

onModeChange((mode, prev) => {
  switch (mode) {
    case GameIDEMode.Game:
      sceneSnapshotBeforeGame = JSON.parse(
        JSON.stringify(getRootTarget() ?? {}),
      ) as SceneObject;
      gameStartRegistry.run();
      break;
    case GameIDEMode.Editor:
      if (prev === GameIDEMode.Game && sceneSnapshotBeforeGame !== undefined) {
        replaceScene(sceneSnapshotBeforeGame);
        sceneSnapshotBeforeGame = undefined;
      }
      editorStartRegistry.run();
      break;
    default:
      break;
  }
});

export function startGameloop(): void {
  const initialMode = getMode();
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
