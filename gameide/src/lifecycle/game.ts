import {
  resetLifecycle,
  runStartsForCurrentMode,
  startGameloop,
  start,
  update,
  gameStart,
  gameUpdate,
  editorStart,
  editorUpdate,
} from "./gameloop.js";
import {
  setScene,
  getScene,
  getRawScene,
  type BaseSceneObject,
} from "../scene/scene.js";
import { reducePlugins, type ApplyPlugins } from "./plugin.js";
import { dispose, runScheduledDisposes } from "./disposeRegistry.js";
import { onModeChange } from "./mode.js";

export type DisposeCallback = (callback: () => void) => void;

export type GameContext<Initial extends object> = Initial & {
  rootElement: HTMLElement;
  initialScene?: BaseSceneObject;
  dispose: DisposeCallback;
};

type WithPlugins<Initial extends object, Plugins extends readonly unknown[]> = ApplyPlugins<
  GameContext<Initial>,
  Plugins
>;

export type GameConfig<Initial extends object, Plugins extends readonly unknown[]> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: BaseSceneObject;
  plugins?: Plugins;
};

let installedContext: unknown;

function contextOrThrow<Context extends object>(): Context {
  if (installedContext === undefined) {
    throw new Error("Game context was read before the game finished a bootstrap round.");
  }
  return installedContext as Context;
}

export type GameAPI<Context extends object = object> = {
  readonly gameContext: Context;
  readonly start: typeof start;
  readonly update: typeof update;
  readonly gameStart: typeof gameStart;
  readonly gameUpdate: typeof gameUpdate;
  readonly editorStart: typeof editorStart;
  readonly editorUpdate: typeof editorUpdate;
  readonly dispose: typeof dispose;
  readonly getScene: typeof getScene;
  readonly getRawScene: typeof getRawScene;
  readonly setScene: typeof setScene;
};

type GameLifecycleAPI = Omit<GameAPI, "gameContext">;

const gameLifecycleAPI: GameLifecycleAPI = {
  start,
  update,
  gameStart,
  gameUpdate,
  editorStart,
  editorUpdate,
  dispose,
  getScene,
  getRawScene,
  setScene,
};

export function gameide<Initial extends object, const Plugins extends readonly unknown[]>(
  config: GameConfig<Initial, Plugins>,
): GameAPI<WithPlugins<Initial, Plugins>> {
  void runGame(config);
  return {
    ...gameLifecycleAPI,
    get gameContext() {
      return contextOrThrow<WithPlugins<Initial, Plugins>>();
    },
  };
}

async function runGame<Initial extends object, const Plugins extends readonly unknown[]>(
  options: GameConfig<Initial, Plugins>,
): Promise<void> {
  const { rootElement, initialContext, initialScene } = options;
  const pluginList = (options.plugins ?? []) as Plugins;

  async function bootstrapRound(): Promise<WithPlugins<Initial, Plugins>> {
    runScheduledDisposes();
    resetLifecycle();
    installedContext = undefined;

    if (initialScene !== undefined) {
      setScene(initialScene);
    }

    const seed: GameContext<Initial> = { ...initialContext, rootElement, dispose, initialScene };
    const context = await reducePlugins(seed, pluginList);

    installedContext = context;

    runStartsForCurrentMode();

    return context;
  }

  // When Changing mode I.E. going from editor -> game rebootstrap
  let sequentialBootstrap = Promise.resolve();
  await bootstrapRound();

  onModeChange(() => {
    const previous = sequentialBootstrap;
    sequentialBootstrap = (async () => {
      await previous;
      await bootstrapRound();
    })();
  });

  startGameloop();
}
