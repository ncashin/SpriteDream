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

type HotModuleReplayArgsState = {
  kind: "unset" | "called";
  args: unknown[];
};

const hotModuleReplayArgsByScope = new Map<string, HotModuleReplayArgsState>();

export function __hotModuleLastArgsForScope(scopeId: string): HotModuleReplayArgsState {
  const key = normalizeHotScopeId(scopeId);
  let state = hotModuleReplayArgsByScope.get(key);
  if (!state) {
    state = { kind: "unset", args: [] };
    hotModuleReplayArgsByScope.set(key, state);
  }
  return state;
}

function runWithHotScope<T>(
  scopeId: string,
  isReplacement: boolean,
  callback: () => T,
): T {
  const normalizedScopeId = normalizeHotScopeId(scopeId);
  const topBefore = activeHotScopes.length - 1;
  const alreadyActive =
    topBefore >= 0 && activeHotScopes[topBefore]?.id === normalizedScopeId;
  if (!alreadyActive) {
    activeHotScopes.push({ id: normalizedScopeId, isReplacement });
  }

  const releaseScope = () => {
    if (alreadyActive) return;
    const top = activeHotScopes.length - 1;
    const scope = top >= 0 ? activeHotScopes[top] : undefined;
    if (scope?.id === normalizedScopeId) {
      activeHotScopes.splice(top, 1);
    }
  };

  try {
    const result = callback();
    const maybePromise = result as unknown as PromiseLike<unknown> | undefined;
    if (maybePromise && typeof maybePromise.then === "function") {
      return Promise.resolve(result).finally(releaseScope) as T;
    }
    releaseScope();
    return result;
  } catch (error) {
    releaseScope();
    throw error;
  }
}

export function __hotModuleDefaultExport<T>(
  scopeId: string,
  state: HotModuleReplayArgsState,
  exported: T,
): T {
  if (typeof exported !== "function") return exported;
  const fn = exported as (...args: unknown[]) => unknown;
  return function hotModuleDefaultWrapper(this: unknown, ...args: unknown[]) {
    state.kind = "called";
    state.args = args;
    return runWithHotScope(scopeId, false, () => fn.apply(this, args));
  } as T;
}

let frameId: number | undefined;
const activeHotScopes: HotModuleScope[] = [];

export function __suspendHotScopes(): HotModuleScope[] {
  return activeHotScopes.splice(0);
}

export function __restoreHotScopes(snapshot: readonly HotModuleScope[]): void {
  activeHotScopes.length = 0;
  activeHotScopes.push(...snapshot);
}

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

function currentScopeId(): string | undefined {
  return activeHotScopes[activeHotScopes.length - 1]?.id;
}

function normalizeHotScopeId(scopeId: string): string {
  return scopeId.replace(/[?#].*$/, "");
}

function shouldRunStartImmediately(): boolean {
  return activeHotScopes[activeHotScopes.length - 1]?.isReplacement !== true;
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
    scopeId: currentScopeId(),
  };
  registrations.push(registration);
  return () => removeRegistration(registrations, registration);
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

export function __beginHotModule(scopeId: string): string {
  const normalizedScopeId = normalizeHotScopeId(scopeId);
  const isReplacement =
    disposedHotScopes.delete(normalizedScopeId) ||
    removeScopedRegistrations(normalizedScopeId) > 0;
  activeHotScopes.push({ id: normalizedScopeId, isReplacement });
  return normalizedScopeId;
}

export function __endHotModule(scopeId: string): void {
  const normalizedScopeId = normalizeHotScopeId(scopeId);
  for (let index = activeHotScopes.length - 1; index >= 0; index -= 1) {
    const scope = activeHotScopes[index];
    if (scope?.id !== normalizedScopeId) continue;
    activeHotScopes.splice(index, 1);
    return;
  }
}

export function __disposeHotModule(scopeId: string): void {
  const normalizedScopeId = normalizeHotScopeId(scopeId);
  removeScopedRegistrations(normalizedScopeId);
  disposedHotScopes.add(normalizedScopeId);
  for (let index = activeHotScopes.length - 1; index >= 0; index -= 1) {
    if (activeHotScopes[index]?.id === normalizedScopeId) {
      activeHotScopes.splice(index, 1);
    }
  }
}

export function __runHotModuleReplay(scopeId: string, replay: () => void): void {
  runWithHotScope(scopeId, true, replay);
}

export function start(callback: StartCallback): DisposeRegistration {
  callback();
  return () => {};
}

export function update(callback: UpdateCallback): DisposeRegistration {
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
