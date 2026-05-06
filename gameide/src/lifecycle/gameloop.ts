import { createCallbackRegistry } from "./callbackRegistry.js";
import { GameIDEMode, getMode } from "./mode.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;

const gameUpdateRegistry = createCallbackRegistry<UpdateCallback>();
const editorUpdateRegistry = createCallbackRegistry<UpdateCallback>();
const alwaysUpdateRegistry = createCallbackRegistry<UpdateCallback>();

/** Queued when mode is not Game or while `beginBootstrapLifecycle` is active. */
const pendingGameStarts: StartCallback[] = [];
/** Queued when mode is not Editor or while `beginBootstrapLifecycle` is active. */
const pendingEditorStarts: StartCallback[] = [];

let bootstrapLifecycleDepth = 0;

let frameId: number | undefined;

/** Clears per-frame update registrations. Start hooks are not stored; pending mode starts are kept. */
export function resetLifecycle(): void {
  gameUpdateRegistry.clear();
  editorUpdateRegistry.clear();
  alwaysUpdateRegistry.clear();
}

export function beginBootstrapLifecycle(): void {
  bootstrapLifecycleDepth++;
}

export function endBootstrapLifecycle(): void {
  bootstrapLifecycleDepth--;
  if (bootstrapLifecycleDepth < 0) {
    bootstrapLifecycleDepth = 0;
  }
  if (bootstrapLifecycleDepth === 0) {
    flushPendingStartsForCurrentMode();
  }
}

function deferringModeStarts(): boolean {
  return bootstrapLifecycleDepth > 0;
}

function flushPendingStartsForCurrentMode(): void {
  switch (getMode()) {
    case GameIDEMode.Game: {
      const queued = pendingGameStarts.splice(0);
      for (const fn of queued) {
        fn();
      }
      break;
    }
    case GameIDEMode.Editor: {
      const queued = pendingEditorStarts.splice(0);
      for (const fn of queued) {
        fn();
      }
      break;
    }
    default:
      break;
  }
}

/** Runs immediately. */
export function start(callback: StartCallback): void {
  callback();
}

export function update(callback: UpdateCallback): void {
  alwaysUpdateRegistry.register(callback);
}

export function gameStart(callback: StartCallback): void {
  if (getMode() !== GameIDEMode.Game || deferringModeStarts()) {
    pendingGameStarts.push(callback);
    return;
  }
  callback();
}

export function gameUpdate(callback: UpdateCallback): void {
  gameUpdateRegistry.register(callback);
}

export function editorStart(callback: StartCallback): void {
  if (getMode() !== GameIDEMode.Editor || deferringModeStarts()) {
    pendingEditorStarts.push(callback);
    return;
  }
  callback();
}

export function editorUpdate(callback: UpdateCallback): void {
  editorUpdateRegistry.register(callback);
}

/** Logs update registry callbacks and counts of queued mode starts. */
export function logLifecycleRegistries(message = "Lifecycle registries"): void {
  console.log(message, {
    start: "immediate",
    gameStart: "immediate when Game (else queued)",
    editorStart: "immediate when Editor (else queued)",
    pendingGameStarts: { count: pendingGameStarts.length },
    pendingEditorStarts: { count: pendingEditorStarts.length },
    alwaysUpdate: {
      count: alwaysUpdateRegistry.callbacks.length,
      callbacks: alwaysUpdateRegistry.callbacks.map(
        (fn, index) => fn.name || `anonymous@${index}`,
      ),
    },
    gameUpdate: {
      count: gameUpdateRegistry.callbacks.length,
      callbacks: gameUpdateRegistry.callbacks.map(
        (fn, index) => fn.name || `anonymous@${index}`,
      ),
    },
    editorUpdate: {
      count: editorUpdateRegistry.callbacks.length,
      callbacks: editorUpdateRegistry.callbacks.map(
        (fn, index) => fn.name || `anonymous@${index}`,
      ),
    },
  });
}

/**
 * Runs any `gameStart` / `editorStart` callbacks that were queued for the current mode.
 * Normally invoked from `endBootstrapLifecycle`; exposed for unusual embedding scenarios.
 */
export function runStartsForCurrentMode(): void {
  flushPendingStartsForCurrentMode();
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
