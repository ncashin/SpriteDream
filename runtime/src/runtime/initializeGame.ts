import { createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import invariant from "tiny-invariant";
import type { GameContext, Plugin } from "./plugin";

type ContextAfter<P> = P extends (context: unknown) => infer R
  ? R extends Promise<infer X>
    ? X
    : R
  : never;

type FullContext<Plugins> = Plugins extends readonly [...unknown[], infer Last]
  ? ContextAfter<Last>
  : GameContext;

export type InitializeGameOptions<Plugins extends readonly Plugin[] = []> = {
  Editor: ComponentType<{ Game: ComponentType }>;
  Game: ComponentType;
  initialContext?: Partial<GameContext>;
  main: (context: FullContext<Plugins>) => void | Promise<void>;
  plugins?: Plugins;
};

export const initializeGame = async <const Plugins extends readonly Plugin[] = []>(
  options: InitializeGameOptions<Plugins>
) => {
  const app = document.getElementById("app");
  invariant(app, "#app element must exist in the DOM");

  const root = createRoot(app);
  flushSync(() => {
    root.render(
      createElement(options.Editor, { Game: options.Game })
    );
  });

  const __gameRoot = document.getElementById("game");
  invariant(__gameRoot, "#game element must exist in the DOM");

  const initialContext: GameContext = {
    __gameRoot,
    ...options.initialContext,
  };

  let context: GameContext = initialContext;
  for (const plugin of options.plugins ?? []) {
    context = await plugin(context);
  }

  await options.main(context as FullContext<Plugins>);
};
