type HotModuleScope = {
  id: string;
  isReplacement: boolean;
};

export type HotModuleReplayArgsState = {
  kind: "unset" | "called";
  args: unknown[];
};

const hotModuleReplayArgsByScope = new Map<string, HotModuleReplayArgsState>();
const activeHotScopes: HotModuleScope[] = [];
const disposedHotScopes = new Set<string>();

type ScopeRegistrationRemover = (scopeId: string) => number;
let removeScopeRegistrations: ScopeRegistrationRemover = () => 0;

export function __wireGameloopHMR(remover: ScopeRegistrationRemover): void {
  removeScopeRegistrations = remover;
}

function normalizeHotScopeId(scopeId: string): string {
  return scopeId.replace(/[?#].*$/, "");
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

export function __hotModuleLastArgsForScope(scopeId: string): HotModuleReplayArgsState {
  const key = normalizeHotScopeId(scopeId);
  let state = hotModuleReplayArgsByScope.get(key);
  if (!state) {
    state = { kind: "unset", args: [] };
    hotModuleReplayArgsByScope.set(key, state);
  }
  return state;
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

export function __suspendHotScopes(): HotModuleScope[] {
  return activeHotScopes.splice(0);
}

export function __restoreHotScopes(snapshot: readonly HotModuleScope[]): void {
  activeHotScopes.length = 0;
  activeHotScopes.push(...snapshot);
}

export function __beginHotModule(scopeId: string): string {
  const normalizedScopeId = normalizeHotScopeId(scopeId);
  const isReplacement =
    disposedHotScopes.delete(normalizedScopeId) ||
    removeScopeRegistrations(normalizedScopeId) > 0;
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
  removeScopeRegistrations(normalizedScopeId);
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

export function currentHotScopeId(): string | undefined {
  return activeHotScopes[activeHotScopes.length - 1]?.id;
}

export function shouldRunStartImmediately(): boolean {
  return activeHotScopes[activeHotScopes.length - 1]?.isReplacement !== true;
}
