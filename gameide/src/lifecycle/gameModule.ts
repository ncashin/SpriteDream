export type GameModule<Context = unknown, Result = unknown> =
  (context: Context) => Result | Promise<Result>;

export type ReduceGameModules<
  Context,
  Modules extends readonly unknown[],
> = Modules extends readonly []
  ? Context
  : Modules extends readonly [infer FirstModule, ...infer RemainingModules]
    ? FirstModule extends GameModule<infer _Needs, infer Adds>
      ? ReduceGameModules<Context & Adds, RemainingModules>
      : ReduceGameModules<Context, RemainingModules>
    : Context;

type UnknownGameModule = (context: unknown) => unknown | Promise<unknown>;

function isGameModule(value: unknown): value is UnknownGameModule {
  return typeof value === "function";
}

export async function reduceGameModules<
  Context,
  const GameModules extends readonly unknown[],
>(
  initial: Context,
  modules: GameModules,
): Promise<Readonly<ReduceGameModules<Context, GameModules>>> {
  let context: Context | ReduceGameModules<Context, GameModules> = initial;
  for (const module of modules) {
    if (isGameModule(module)) {
      context = await module(context);
    }
  }
  return context;
}
