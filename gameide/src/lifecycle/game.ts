import { resetLifecycle, runStartsForCurrentMode, startGameloop } from "./gameloop.js";
import { setScene, type BaseSceneObject } from "../scene/scene.js";
import { reducePlugins, type ApplyPlugins } from "./plugin.js";
import { onModeChange } from "./mode.js";
import { dispose, runScheduledDisposes } from "./disposeRegistry.js";

export type DisposeCallback = (callback: () => void) => void;

export type GameContext<Initial extends object> = Initial & {
  rootElement: HTMLElement;
  initialScene?: BaseSceneObject;
  dispose: DisposeCallback;
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
  initialScene?: BaseSceneObject;
  plugins?: Plugins;
};

export type GameOptions<
  Initial extends object,
  Plugins extends readonly unknown[],
> = GameConfig<Initial, Plugins> & {
  main: GameMain<Initial, Plugins>;
};

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

  async function bootstrapRound(): Promise<
    ApplyPlugins<GameContext<Initial>, Plugins>
  > {
    runScheduledDisposes();

    resetLifecycle();

    if (initialScene !== undefined) {
      setScene(initialScene);
    }

    const seed = {
      ...initialContext,
      rootElement,
      dispose,
      ...(initialScene !== undefined && { initialScene }),
    } as GameContext<Initial>;

    const context = await reducePlugins(seed, pluginList);

    void main(context);

    runStartsForCurrentMode();

    return context;
  }

  let sequentialBootstrap = Promise.resolve();

  const initialContextResult = await bootstrapRound();

  onModeChange(() => {
    sequentialBootstrap = sequentialBootstrap.then(() =>
      bootstrapRound().then(() => {}),
    );
  });

  startGameloop();

  return initialContextResult;
}
