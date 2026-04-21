import { startGameloop } from "./gameloop.js";
import type { SceneObject } from "../scene/scene.js";
import { setScene } from "../scene/scene.js";
import { reducePlugins, type ApplyPlugins } from "./plugin.js";

export type GameContext<Initial extends object> = Initial & {
  rootElement: HTMLElement;
  initialScene?: SceneObject;
};

export type GameMain<
  Initial extends object,
  Plugins extends readonly unknown[],
> = (
  context: ApplyPlugins<GameContext<Initial>, Plugins>,
) => void | Promise<void>;

export type GameConfig<
  Initial extends object,
  Plugins extends readonly unknown[],
> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: SceneObject;
  plugins?: Plugins;
};

export type GameOptions<
  Initial extends object,
  Plugins extends readonly unknown[],
> = GameConfig<Initial, Plugins> & {
  main: GameMain<Initial, Plugins>;
};

/** Binds scene, plugins, and seed context; pass `main` in a second call so its `context` is contextually typed. */
export function game<
  Initial extends object,
  const Plugins extends readonly unknown[],
>(
  config: GameConfig<Initial, Plugins>,
): (
  main: GameMain<Initial, Plugins>,
) => Promise<ApplyPlugins<GameContext<Initial>, Plugins>> {
  return (main) => runGame({ ...config, main });
}

async function runGame<
  Initial extends object,
  const Plugins extends readonly unknown[],
>(
  options: GameOptions<Initial, Plugins>,
): Promise<ApplyPlugins<GameContext<Initial>, Plugins>> {
  const { rootElement, initialContext, initialScene, main } = options;
  const pluginList = (options.plugins ?? []) as Plugins;

  if (initialScene !== undefined) {
    setScene(initialScene);
  }

  const seed = {
    ...initialContext,
    rootElement,
    ...(initialScene !== undefined && { initialScene }),
  } as GameContext<Initial>;

  const context = await reducePlugins(seed, pluginList);
  void main(context);
  startGameloop();
  return context;
}
