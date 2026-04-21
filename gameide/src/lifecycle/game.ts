import { startGameloop } from "./gameloop.js";
import type { SceneObject } from "../scene/scene.js";
import { setScene } from "../scene/scene.js";
import { reducePlugins, type ApplyPlugins } from "./plugin.js";

export type GameContextSeed<
  Initial extends object,
  Scene extends SceneObject | undefined,
> = Initial &
  { rootElement: HTMLElement } &
  (Scene extends SceneObject ? { initialScene: Scene } : {});

export type GameOptions<
  Initial extends object,
  Plugins extends readonly unknown[],
  Scene extends SceneObject | undefined = undefined,
> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: Scene;
  plugins?: Plugins;
  main: (
    ctx: ApplyPlugins<GameContextSeed<Initial, Scene>, Plugins>,
  ) => void | Promise<void>;
};

export async function game<
  Initial extends object,
  const Plugins extends readonly unknown[],
  Scene extends SceneObject | undefined = undefined,
>(
  options: GameOptions<Initial, Plugins, Scene>,
): Promise<ApplyPlugins<GameContextSeed<Initial, Scene>, Plugins>> {
  let result: GameContextSeed<Initial, Scene> = {
    ...options.initialContext,
    rootElement: options.rootElement,
    ...(options.initialScene !== undefined
      ? { initialScene: options.initialScene }
      : {}),
  } as GameContextSeed<Initial, Scene>;

  if (options.initialScene !== undefined) {
    setScene(options.initialScene);
  }

  const pluginList = (options.plugins ?? []) as Plugins;
  const context = await reducePlugins(result, pluginList);

  void options.main(context);
  startGameloop();

  return context;
}