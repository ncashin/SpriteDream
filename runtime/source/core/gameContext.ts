import { setScene } from "./scene/scene";
import type { Root } from "react-dom/client";
import { isDevelopment } from "./utils";

export type InitialGameContext = {
  rootElement: HTMLElement;
  editorRootElement: HTMLElement;
  editorRoot: Root | null;
};

export type ContextExtension<T extends InitialGameContext, Extension> = T &
  Extension;

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

export type RequirePlugin<T extends readonly Plugin<any, any>[]> =
  AccumulatePluginResults<T> & {
    ecs: ReturnType<typeof import("./ecs/ecs").curryECSInstance>;
  };

export const initializeGameContext = <T extends readonly Plugin<any, any>[]>({
  initialContext,
  plugins,
  initialScene,
}: {
  initialContext: InitialGameContext;
  plugins: [...T];
  initialScene: string;
}): AccumulatePluginResults<T> => {
  if (!isDevelopment) {
    void setScene(initialScene);
  }

  return plugins.reduce(
    (context, plugin) => plugin(context),
    initialContext
  ) as AccumulatePluginResults<T>;
};
