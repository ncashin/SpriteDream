
export type InitialGameContext = {
  rootElement: HTMLElement;
  editorRootElement: HTMLElement;
};

export type ContextExtension<T extends InitialGameContext, Extension> = T & Extension;

export type Plugin<Context = any, Result = any> = (context: Context) => Result;

type AccumulatePluginResults<
  T extends readonly Plugin<any, any>[],
  Acc = InitialGameContext
> = T extends readonly [infer First, ...infer Rest]
  ? First extends Plugin<any, infer R>
    ? Rest extends readonly Plugin<any, any>[]
      ? AccumulatePluginResults<Rest, Acc & R>
      : Acc & R
    : Acc
  : Acc;

export type RequirePlugin<
  T extends readonly Plugin<any, any>[]
> = AccumulatePluginResults<T> & {
  ecs: ReturnType<typeof import("./ecs/ecs").curryECSInstance>;
};

export const initializePlugins = <
  T extends readonly Plugin<any, any>[]
>({
  initialContext,
  plugins,
}: {
  initialContext: InitialGameContext;
  plugins: [...T];
}): AccumulatePluginResults<T> => {
  return plugins.reduce(
    (context, plugin) => plugin(context),
    initialContext
  ) as AccumulatePluginResults<T>;
};
