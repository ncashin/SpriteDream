export type GameModule<Context = unknown, Result = unknown> =
  (context: Context) => Result | Promise<Result>;

export type ReduceGameModules<
  Context,
  Modules extends readonly unknown[]
> = Modules extends [infer FirstModule, ...infer RemainingModules]
  ? FirstModule extends GameModule<infer Needs, infer Adds>
    ? ReduceGameModules<Context & Adds, RemainingModules>
    : ReduceGameModules<Context, RemainingModules>
  : Context;

export async function reduceGameModules<
  Context,
  GameModules extends readonly GameModule<any, any>[]
>(
  initial: Context,
  modules: GameModules
): Promise<ReduceGameModules<Context, GameModules>> {
  let context: unknown = initial;
  for (const module of modules) {
    context = typeof module === "function"
      ? await module(context)
      : context;
  }
  return context as ReduceGameModules<Context, GameModules>;
}
