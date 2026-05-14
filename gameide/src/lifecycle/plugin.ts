export type Plugin<Needs extends object = object, Adds extends object = object> =
  <Context extends Needs>(context: Context) =>
    | (Context & Adds)
    | Promise<Context & Adds>;

export type ApplyPlugins<Context, Plugins extends readonly unknown[]> =
  Plugins extends readonly [infer Head, ...infer Rest extends readonly unknown[]]
    ? Head extends Plugin<infer Needs, infer Adds>
      ? Context extends Needs
        ? ApplyPlugins<Context & Adds, Rest>
        : ApplyPlugins<Context, Rest>
      : Head extends (context: Context) => infer R
        ? ApplyPlugins<Context & Awaited<R>, Rest>
        : ApplyPlugins<Context, Rest>
    : Context;

export function plugins<const T extends readonly unknown[]>(list: T): T {
  return list;
}

export async function reducePlugins<
  Context,
  const Plugins extends readonly unknown[],
>(
  initial: Context,
  pluginList: Plugins,
): Promise<ApplyPlugins<Context, Plugins>> {
  let context: unknown = initial;
  for (const plugin of pluginList) {
    if (typeof plugin === "function") {
      context = await (plugin as (c: unknown) => unknown)(context);
    }
  }
  return context as ApplyPlugins<Context, Plugins>;
}
