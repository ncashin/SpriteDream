// Reduce a list of GameModules over a context, applying each in sequence.

export type GameModule<Context = unknown, Result = unknown> =
  (context: Context) => Result | Promise<Result>;

export type ReduceGameModules<
  Context,
  Modules extends readonly unknown[]
> = Modules extends [infer M, ...infer Rest]
  ? M extends GameModule<infer Needs, infer Adds>
    ? ReduceGameModules<Context & Adds, Rest>
    : ReduceGameModules<Context, Rest>
  : Context;

export async function reduceGameModules<
  Context,
  Modules extends readonly GameModule<any, any>[]
>(
  initial: Context,
  modules: Modules
): Promise<ReduceGameModules<Context, Modules>> {
  let ctx: unknown = initial;
  for (const mod of modules) {
    ctx = typeof mod === "function"
      ? await mod(ctx)
      : ctx;
  }
  return ctx as ReduceGameModules<Context, Modules>;
}
