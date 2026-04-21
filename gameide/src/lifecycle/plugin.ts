type PluginReturn<F> = F extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

/**
 * Context object after running each plugin in order; each plugin’s return
 * type (sync or async) becomes the input to the next.
 */
export type ApplyPlugins<
  Base extends object,
  Plugins extends readonly unknown[],
> = Plugins extends readonly []
  ? Base
  : Plugins extends readonly [infer Head, ...infer Tail]
    ? Head extends (...args: never[]) => unknown
      ? PluginReturn<Head> extends infer Out
        ? Out extends object
          ? ApplyPlugins<Out, Tail extends readonly unknown[] ? Tail : []>
          : Base
        : Base
      : Base
    : Base;

export function plugins<const T extends readonly unknown[]>(
  plugins: T,
): T {
  return plugins;
}

export async function reducePlugins<
  Context extends object,
  const Plugins extends readonly unknown[],
>(
  initial: Context,
  pluginList: Plugins,
): Promise<ApplyPlugins<Context, Plugins>> {
  let result: object = initial;
  for (const plugin of pluginList) {
    if (typeof plugin === "function") {
      const next = await (plugin as (ctx: object) => unknown)(result);
      result = next as object;
    }
  }
  return result as ApplyPlugins<Context, Plugins>;
}
