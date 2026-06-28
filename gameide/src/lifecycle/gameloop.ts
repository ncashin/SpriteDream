import { GameIDEMode, getMode, onModeChange } from "./mode.js";
import {
  __wireGameloopHMR,
  currentHotScopeId,
  shouldRunStartImmediately,
} from "./gameloopHMR.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;
type DisposeRegistration = () => void;

type UpdateRegistration = {
  callback: UpdateCallback;
  scopeId?: string;
};

type StartRegistration = {
  callback: StartCallback;
  mode: GameIDEMode;
  releaseModeWatcher: DisposeRegistration;
  scopeId?: string;
};

const gameStarts: StartRegistration[] = [];
const editorStarts: StartRegistration[] = [];
const gameUpdates: UpdateRegistration[] = [];
const editorUpdates: UpdateRegistration[] = [];
const alwaysUpdates: UpdateRegistration[] = [];

const scheduledDisposes: (() => void)[] = [];

let frameId: number | undefined;

export function dispose(fn: () => void): void {
  scheduledDisposes.push(fn);
}

export function flushScheduledDisposes(): void {
  while (scheduledDisposes.length > 0) {
    const callback = scheduledDisposes.pop();
    callback?.();
  }
}

function runUpdates(
  callbacks: readonly UpdateRegistration[],
  deltaTime: number,
): void {
  for (const registration of callbacks) registration.callback(deltaTime);
}

function removeRegistration<T>(registrations: T[], registration: T): void {
  const index = registrations.indexOf(registration);
  if (index !== -1) registrations.splice(index, 1);
}

function removeFromEndWhere<T>(
  registrations: T[],
  predicate: (registration: T) => boolean,
  onRemove?: (registration: T) => void,
): number {
  let removed = 0;
  for (let index = registrations.length - 1; index >= 0; index -= 1) {
    const registration = registrations[index];
    if (!registration || !predicate(registration)) continue;
    onRemove?.(registration);
    registrations.splice(index, 1);
    removed += 1;
  }
  return removed;
}

function registerUpdate(
  registrations: UpdateRegistration[],
  callback: UpdateCallback,
): DisposeRegistration {
  const registration: UpdateRegistration = {
    callback,
    scopeId: currentHotScopeId(),
  };
  registrations.push(registration);
  return () => removeRegistration(registrations, registration);
}

function registerModeStart(
  registrations: StartRegistration[],
  mode: GameIDEMode,
  callback: StartCallback,
): DisposeRegistration {
  const scopeId = currentHotScopeId();
  const registration: StartRegistration = {
    callback,
    mode,
    scopeId,
    releaseModeWatcher: () => {},
  };

  registration.releaseModeWatcher = onModeChange((nextMode) => {
    if (nextMode !== mode) return;
    callback();
  });

  registrations.push(registration);

  if (getMode() === mode && shouldRunStartImmediately()) {
    callback();
  }

  return () => {
    registration.releaseModeWatcher();
    removeRegistration(registrations, registration);
  };
}

function removeScopedRegistrations(scopeId: string): number {
  const matchesScope = (registration: { scopeId?: string }) =>
    registration.scopeId === scopeId;

  let removed = 0;
  for (const registrations of [alwaysUpdates, gameUpdates, editorUpdates]) {
    removed += removeFromEndWhere(registrations, matchesScope);
  }
  for (const registrations of [gameStarts, editorStarts]) {
    removed += removeFromEndWhere(registrations, matchesScope, (registration) => {
      registration.releaseModeWatcher();
    });
  }
  return removed;
}

__wireGameloopHMR(removeScopedRegistrations);

export function __runModeStarts(mode: GameIDEMode): void {
  const registrations = mode === GameIDEMode.Game ? gameStarts : editorStarts;
  for (const registration of registrations) {
    registration.callback();
  }
}

export function onStart(callback: StartCallback): DisposeRegistration {
  callback();
  return () => {};
}

export function onUpdate(callback: UpdateCallback): DisposeRegistration {
  return registerUpdate(alwaysUpdates, callback);
}

export function onGameStart(callback: StartCallback): DisposeRegistration {
  return registerModeStart(gameStarts, GameIDEMode.Game, callback);
}

export function onGameUpdate(callback: UpdateCallback): DisposeRegistration {
  return registerUpdate(gameUpdates, callback);
}

export function onEditorStart(callback: StartCallback): DisposeRegistration {
  return registerModeStart(editorStarts, GameIDEMode.Editor, callback);
}

export function onEditorUpdate(callback: UpdateCallback): DisposeRegistration {
  return registerUpdate(editorUpdates, callback);
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
