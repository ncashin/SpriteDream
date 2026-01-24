import type { Root } from "react-dom/client";
import type { ComponentType } from "react";
import { defineMainFunction, runGame } from "./runtimeWrapper";
import { setScene, hasScene } from "./scene/scene";

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
  EditorUI?: ComponentType;
  GameUI?: ComponentType;
};

function createGameContext<T extends readonly Plugin<any, any>[]>(
  initialContext: InitialGameContext,
  plugins: T,
  initialScene: string
): AccumulatePluginResults<T> {
  return (plugins as unknown as Plugin<any, any>[]).reduce(
    (context, plugin) => plugin(context),
    initialContext as AccumulatePluginResults<T>
  );
}

export function initializeGame<T extends readonly Plugin<any, any>[]>({
  plugins,
  initialScene,
  main,
  EditorUI,
  GameUI,
}: GameConfig<T>): void {
  if (!hasScene()) {
    setScene(initialScene);
  }

  defineMainFunction((initialContext: InitialGameContext) => {
    const gameContext = createGameContext(initialContext, plugins, initialScene);
    main?.(gameContext);
  });

  runGame(EditorUI, GameUI);
}
