import type { DisposeCallback } from "./gameloop.js";

export type GameModule<Context = unknown, Result = unknown> =
  (context: Context) => Result | Promise<Result>;

export type UnknownGameModule = GameModule<any, any>;

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

const GAME_MODULE_IDENTIFIER: unique symbol = Symbol(
  "gameide.gameModuleIdentifier",
);

type TaggedGameModule = UnknownGameModule & {
  [GAME_MODULE_IDENTIFIER]?: string;
};

type GameModuleHMRRecord = {
  module: UnknownGameModule;
  moduleIdentifier?: string;
  scopeDisposes: DisposeCallback[];
  contextAfter: unknown;
};

type GameModuleHMRState = {
  baseContext: unknown;
  records: GameModuleHMRRecord[];
};

let hmrState: GameModuleHMRState | null = null;

function normalizeGameModuleIdentifier(identifier: string): string {
  const url = new URL(identifier);
  url.search = "";
  url.hash = "";
  return url.href;
}

function gameModuleIdentifiersMatch(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (left === undefined || right === undefined) return false;
  return (
    normalizeGameModuleIdentifier(left) ===
    normalizeGameModuleIdentifier(right)
  );
}

export function gameModule<Context, Result>(
  identifier: string,
  module: GameModule<Context, Result>,
): GameModule<Context, Result> {
  Object.defineProperty(module, GAME_MODULE_IDENTIFIER, {
    value: normalizeGameModuleIdentifier(identifier),
    writable: true,
    configurable: true,
  });
  return module;
}

const curriedGameModuleArgsByIdentifier = new Map<string, unknown[]>();

export function curriedGameModule<Args extends unknown[], Context, Result>(
  identifier: string,
  module: (...args: Args) => GameModule<Context, Result>,
): (...args: Args) => GameModule<Context, Result> {
  const normalizedIdentifier = normalizeGameModuleIdentifier(identifier);
  const wrapped = (...args: Args) => {
    curriedGameModuleArgsByIdentifier.set(normalizedIdentifier, args);
    return gameModule(identifier, module(...args));
  };
  return wrapped;
}

export async function rerunCurriedGameModule(
  identifier: string,
  module: (...args: unknown[]) => UnknownGameModule,
): Promise<void> {
  const normalizedIdentifier = normalizeGameModuleIdentifier(identifier);
  const args = curriedGameModuleArgsByIdentifier.get(normalizedIdentifier);
  if (!args) return;

  const inner = gameModule(identifier, module(...args));
  await rerunGameModule(identifier, inner);
}

function getGameModuleIdentifier(
  module: UnknownGameModule,
): string | undefined {
  return (module as TaggedGameModule)[GAME_MODULE_IDENTIFIER];
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
      moduleIdentifier: getGameModuleIdentifier(module),
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
      moduleIdentifier: getGameModuleIdentifier(module),
      scopeDisposes,
      contextAfter: context,
    });
  }
}

export async function rerunGameModule(
  identifier: string,
  module: UnknownGameModule,
): Promise<void> {
  if (!hmrState) return;

  const normalizedIdentifier = normalizeGameModuleIdentifier(identifier);
  gameModule(identifier, module);

  const fromIndex = hmrState.records.findIndex((record) =>
    gameModuleIdentifiersMatch(record.moduleIdentifier, normalizedIdentifier),
  );
  if (fromIndex === -1) return;

  await rerunReduceFrom(fromIndex, [module]);
}
