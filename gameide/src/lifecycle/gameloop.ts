import { GameIDEMode, getMode, onModeChange } from "./mode.js";

type StartCallback = () => void;
type UpdateCallback = (deltaTime: number) => void;
type DisposeRegistration = () => void;

type HotModuleScope = {
  id: string;
  isReplacement: boolean;
};

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
const disposedHotScopes = new Set<string>();

let frameId: number | undefined;
const activeHotScopes: HotModuleScope[] = [];

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
  callbacks: readonly UpdateRegistration[],
  deltaTime: number,
): void {
  for (const registration of callbacks) registration.callback(deltaTime);
}

function currentScopeId(): string | undefined {
  return activeHotScopes[activeHotScopes.length - 1]?.id;
}

function shouldRunStartImmediately(): boolean {
  return activeHotScopes[activeHotScopes.length - 1]?.isReplacement !== true;
}

function removeRegistration<T>(registrations: T[], registration: T): void {
  const index = registrations.indexOf(registration);
  if (index !== -1) registrations.splice(index, 1);
}

function removeUpdateRegistration(
  registrations: UpdateRegistration[],
  registration: UpdateRegistration,
): void {
  removeRegistration(registrations, registration);
}

function registerUpdate(
  registrations: UpdateRegistration[],
  callback: UpdateCallback,
): DisposeRegistration {
  const registration: UpdateRegistration = {
    callback,
    scopeId: currentScopeId(),
  };
  registrations.push(registration);
  return () => removeUpdateRegistration(registrations, registration);
}

function registerModeStart(
  registrations: StartRegistration[],
  mode: GameIDEMode,
  callback: StartCallback,
): DisposeRegistration {
  const scopeId = currentScopeId();
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
  let removed = 0;

  const removeScopedUpdates = (registrations: UpdateRegistration[]) => {
    for (let index = registrations.length - 1; index >= 0; index -= 1) {
      if (registrations[index]?.scopeId !== scopeId) continue;
      registrations.splice(index, 1);
      removed += 1;
    }
  };

  const removeScopedStarts = (registrations: StartRegistration[]) => {
    for (let index = registrations.length - 1; index >= 0; index -= 1) {
      const registration = registrations[index];
      if (!registration || registration.scopeId !== scopeId) continue;
      registration.releaseModeWatcher();
      registrations.splice(index, 1);
      removed += 1;
    }
  };

  removeScopedUpdates(alwaysUpdates);
  removeScopedUpdates(gameUpdates);
  removeScopedUpdates(editorUpdates);
  removeScopedStarts(gameStarts);
  removeScopedStarts(editorStarts);

  return removed;
}

export function __beginHotModule(scopeId: string): string {
  const isReplacement =
    disposedHotScopes.delete(scopeId) || removeScopedRegistrations(scopeId) > 0;
  activeHotScopes.push({ id: scopeId, isReplacement });
  return scopeId;
}

export function __endHotModule(scopeId: string): void {
  for (let index = activeHotScopes.length - 1; index >= 0; index -= 1) {
    if (activeHotScopes[index]?.id !== scopeId) continue;
    activeHotScopes.splice(index, 1);
    return;
  }
}

export function __disposeHotModule(scopeId: string): void {
  removeScopedRegistrations(scopeId);
  disposedHotScopes.add(scopeId);
  for (let index = activeHotScopes.length - 1; index >= 0; index -= 1) {
    if (activeHotScopes[index]?.id === scopeId) activeHotScopes.splice(index, 1);
  }
}

export function start(callback: StartCallback): DisposeRegistration {
  callback();
  return () => {};
}

export function update(callback: UpdateCallback): DisposeRegistration {
  return registerUpdate(alwaysUpdates, callback);
}

export function gameStart(callback: StartCallback): DisposeRegistration {
  return registerModeStart(gameStarts, GameIDEMode.Game, callback);
}

export function gameUpdate(callback: UpdateCallback): DisposeRegistration {
  return registerUpdate(gameUpdates, callback);
}

export function editorStart(callback: StartCallback): DisposeRegistration {
  return registerModeStart(editorStarts, GameIDEMode.Editor, callback);
}

export function editorUpdate(callback: UpdateCallback): DisposeRegistration {
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
