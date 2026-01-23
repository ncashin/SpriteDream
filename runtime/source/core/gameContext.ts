import { setScene } from "./scene/scene";
import type { Root } from "react-dom/client";
import { isDevelopment, isEditorMode } from "./utils";
import { defineMainFunction, runGame } from "./runtimeWrapper";

export type InitialGameContext = {
  rootElement: HTMLElement;
  editorRootElement: HTMLElement;
  editorRoot: Root | null;
};

export type ContextExtension<T extends InitialGameContext, Extension> = T &
  Extension;

export type Plugin<Context = any, Result = any> = (context: Context) => Result;

export type AccumulatePluginResults<
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

export type GameConfig<T extends readonly Plugin<any, any>[]> = {
  plugins: T;
  initialScene: string;
  main?: (context: AccumulatePluginResults<T>) => void;
};

function createGameContext<T extends readonly Plugin<any, any>[]>(
  initialContext: InitialGameContext,
  plugins: T,
  initialScene: string
): AccumulatePluginResults<T> {
  const editorEnabled = isEditorMode();

  if (!isDevelopment && editorEnabled) {
    void setScene(initialScene);
  }

  return (plugins as unknown as Plugin<any, any>[]).reduce(
    (context, plugin) => plugin(context),
    initialContext as AccumulatePluginResults<T>
  );
}

export function initializeGame<T extends readonly Plugin<any, any>[]>({
  plugins,
  initialScene,
  main,
}: GameConfig<T>): void {
  defineMainFunction((initialContext: InitialGameContext) => {
    const gameContext = createGameContext(initialContext, plugins, initialScene);
    main?.(gameContext);
  });

  runGame();
}
