import { setSceneFile } from "./scene/scene";

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

export const initializeGameContext = <
  T extends readonly Plugin<any, any>[]
>({
  initialContext,
  plugins,
  initialScene,
}: {
  initialContext: InitialGameContext;
  plugins: [...T];
  initialScene?: string;
}): AccumulatePluginResults<T> => {
  // Set scene data from Vite import if provided
  // This is the only place where scene data should be initialized
  // In production, scene data comes from Vite's bundling (import sceneData from './scenes/default.scene?raw')
  // In development, it can also come from here or be loaded via file operations
  if (initialScene) {
    void setSceneFile("", initialScene);
  }

  return plugins.reduce(
    (context, plugin) => plugin(context),
    initialContext
  ) as AccumulatePluginResults<T>;
};
