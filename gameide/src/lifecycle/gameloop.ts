import { GameIDEMode, getMode, onModeChange } from "./mode.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;

const gameUpdates: UpdateCallback[] = [];
const editorUpdates: UpdateCallback[] = [];
const alwaysUpdates: UpdateCallback[] = [];

const scheduledDisposes: (() => void)[] = [];

let frameId: number | undefined;

export function dispose(fn: () => void): void {
  scheduledDisposes.push(fn);
}

function runScheduledDisposes(): void {
  while (scheduledDisposes.length > 0) {
    const callback = scheduledDisposes.pop();
    callback?.();
  }
}

export function flushScheduledDisposes(): void {
  runScheduledDisposes();
}

function runUpdates(
  callbacks: readonly UpdateCallback[],
  deltaTime: number,
): void {
  for (const callback of callbacks) callback(deltaTime);
}

export function start(callback: StartCallback): void {
  callback();
}

export function update(callback: UpdateCallback): void {
  alwaysUpdates.push(callback);
}

export function gameStart(callback: StartCallback): void {
  onModeChange((mode) => {
    if (mode !== GameIDEMode.Game) return;
    callback();
  });
  if (getMode() !== GameIDEMode.Game) return;
  callback();
}

export function gameUpdate(callback: UpdateCallback): void {
  gameUpdates.push(callback);
}

export function editorStart(callback: StartCallback): void {
  onModeChange((mode) => {
    if (mode !== GameIDEMode.Editor) return;
    callback();
  });
  if (getMode() !== GameIDEMode.Editor) return;
  callback();
}

export function editorUpdate(callback: UpdateCallback): void {
  editorUpdates.push(callback);
}

export function startGameloop(): void {
  if (frameId !== undefined) return;
  let lastTime = performance.now();

  function tick(now: number): void {
    frameId = requestAnimationFrame(tick);
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    runUpdates(alwaysUpdates, deltaTime);

    switch (getMode()) {
      case GameIDEMode.Game:
        runUpdates(gameUpdates, deltaTime);
        break;
      case GameIDEMode.Editor:
        runUpdates(editorUpdates, deltaTime);
        break;
      default:
        break;
    }
  }

  frameId = requestAnimationFrame(tick);
}
