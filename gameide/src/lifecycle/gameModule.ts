import type { DisposeCallback } from "./gameloop.js";

export type GameModule<Context = unknown, Result = unknown> =
  (context: Context) => Result | Promise<Result>;

export type UnknownGameModule = (context: unknown) => unknown | Promise<unknown>;

export type ReduceGameModules<
  Context,
  Modules extends readonly UnknownGameModule[],
> = Modules extends readonly []
  ? Context
  : Modules extends readonly [
      infer FirstModule,
      ...infer RemainingModules extends readonly UnknownGameModule[],
    ]
    ? FirstModule extends GameModule<infer _Needs, infer Adds>
      ? ReduceGameModules<Context & Adds, RemainingModules>
      : ReduceGameModules<Context, RemainingModules>
    : Context;

const scopeStack: DisposeCallback[][] = [];

export function isInGameModuleScope(): boolean {
  return scopeStack.length > 0;
}

export function trackGameModuleDispose(dispose: DisposeCallback): void {
  const scope = scopeStack[scopeStack.length - 1];
  scope?.push(dispose);
}

function enterGameModuleScope(): void {
  scopeStack.push([]);
}

function exitGameModuleScope(): DisposeCallback[] {
  return scopeStack.pop() ?? [];
}

function disposeGameModuleScope(disposers: DisposeCallback[]): void {
  while (disposers.length > 0) {
    disposers.pop()?.();
  }
}

const GAME_MODULE_ID: unique symbol = Symbol("gameide.gameModuleId");

type TaggedGameModule = UnknownGameModule & {
  [GAME_MODULE_ID]?: string;
};

type GameModuleHMRRecord = {
  module: UnknownGameModule;
  moduleId?: string;
  scopeDisposes: DisposeCallback[];
  contextAfter: unknown;
};

type GameModuleHMRState = {
  baseContext: unknown;
  records: GameModuleHMRRecord[];
};

let hmrState: GameModuleHMRState | null = null;

function normalizeGameModuleId(id: string): string {
  const url = new URL(id);
  url.search = "";
  url.hash = "";
  return url.href;
}

function gameModuleIdsMatch(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (left === undefined || right === undefined) return false;
  return normalizeGameModuleId(left) === normalizeGameModuleId(right);
}

export function gameModule<Context, Result>(
  id: string,
  module: GameModule<Context, Result>,
): GameModule<Context, Result> {
  Object.defineProperty(module, GAME_MODULE_ID, {
    value: normalizeGameModuleId(id),
    writable: true,
    configurable: true,
  });
  return module;
}

const curriedGameModuleArgsById = new Map<string, unknown[]>();

export function curriedGameModule<Args extends unknown[], Context, Result>(
  id: string,
  module: (...args: Args) => GameModule<Context, Result>,
): (...args: Args) => GameModule<Context, Result> {
  const normalizedId = normalizeGameModuleId(id);
  const wrapped = (...args: Args) => {
    curriedGameModuleArgsById.set(normalizedId, args);
    return gameModule(id, module(...args));
  };
  return wrapped;
}

export async function rerunCurriedGameModule(
  id: string,
  module: (...args: unknown[]) => UnknownGameModule,
): Promise<void> {
  const normalizedId = normalizeGameModuleId(id);
  const args = curriedGameModuleArgsById.get(normalizedId);
  if (!args) return;

  const inner = gameModule(id, module(...args));
  await rerunGameModule(id, inner);
}

function getGameModuleId(module: UnknownGameModule): string | undefined {
  return (module as TaggedGameModule)[GAME_MODULE_ID];
}

function isGameModule(value: unknown): value is UnknownGameModule {
  return typeof value === "function";
}

export async function reduceGameModules<
  Context,
  const GameModules extends readonly UnknownGameModule[],
>(
  initial: Context,
  modules: GameModules,
): Promise<Readonly<ReduceGameModules<Context, GameModules>>> {
  let context: unknown = initial;
  const records: GameModuleHMRRecord[] = [];

  for (const module of modules) {
    enterGameModuleScope();
    context = await module(context);
    const scopeDisposes = exitGameModuleScope();
    records.push({
      module,
      moduleId: getGameModuleId(module),
      scopeDisposes,
      contextAfter: context,
    });
  }

  hmrState = { baseContext: initial, records };

  return context as Readonly<ReduceGameModules<Context, GameModules>>;
}

export async function rerunReduceFrom(
  fromIndex: number,
  modules: readonly UnknownGameModule[],
): Promise<void> {
  if (!hmrState) return;

  const { records, baseContext } = hmrState;

  while (records.length > fromIndex) {
    const record = records.pop();
    if (record) disposeGameModuleScope(record.scopeDisposes);
  }

  let context =
    records.length > 0
      ? records[records.length - 1]!.contextAfter
      : baseContext;

  for (const module of modules) {
    if (!isGameModule(module)) continue;

    enterGameModuleScope();
    context = await module(context);
    const scopeDisposes = exitGameModuleScope();
    records.push({
      module,
      moduleId: getGameModuleId(module),
      scopeDisposes,
      contextAfter: context,
    });
  }
}

export async function rerunGameModule(
  id: string,
  module: UnknownGameModule,
): Promise<void> {
  if (!hmrState) return;

  const normalizedId = normalizeGameModuleId(id);
  gameModule(id, module);

  const fromIndex = hmrState.records.findIndex((record) =>
    gameModuleIdsMatch(record.moduleId, normalizedId),
  );
  if (fromIndex === -1) return;

  await rerunReduceFrom(fromIndex, [module]);
}
