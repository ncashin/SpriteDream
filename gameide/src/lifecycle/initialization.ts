import {
  flushScheduledDisposes,
  startGameloop,
  start,
  update,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  dispose,
  __suspendHotScopes,
  __restoreHotScopes,
} from "./gameloop.js";
import {
  setScene,
  getScene,
  getRawScene,
  type Scene,
  type SceneObject,
} from "../scene/scene.js";
import { reducePlugins, type ApplyPlugins } from "./plugin.js";

export type DisposeCallback = (callback: () => void) => void;

export type GameContext<Initial extends object> = Initial & {
  rootElement: HTMLElement;
  initialScene?: SceneObject;
  scene: Scene;
  dispose: DisposeCallback;
};

type WithPlugins<Initial extends object, Plugins extends readonly unknown[]> = ApplyPlugins<
  GameContext<Initial>,
  Plugins
>;

export type GameConfig<Initial extends object, Plugins extends readonly unknown[]> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: SceneObject;
  plugins?: Plugins;
};

let installedContext: unknown;

export function getGameContext<Context extends object = object>(): Context {
  if (installedContext === undefined) {
    throw new Error("Game context was read before the game finished initializing.");
  }
  return installedContext as Context;
}

export type GameAPI<Context extends object = object> = {
  readonly gameContext: Context;
  readonly start: typeof start;
  readonly update: typeof update;
  readonly onGameStart: typeof onGameStart;
  readonly onGameUpdate: typeof onGameUpdate;
  readonly onEditorStart: typeof onEditorStart;
  readonly onEditorUpdate: typeof onEditorUpdate;
  readonly dispose: typeof dispose;
  readonly getScene: typeof getScene;
  readonly getRawScene: typeof getRawScene;
  readonly setScene: typeof setScene;
};

type GameLifecycleAPI = Omit<GameAPI, "gameContext">;

const gameLifecycleAPI: GameLifecycleAPI = {
  start,
  update,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  dispose,
  getScene,
  getRawScene,
  setScene,
};

export async function gameide<Initial extends object, const Plugins extends readonly unknown[]>(
  config: GameConfig<Initial, Plugins>,
): Promise<GameAPI<WithPlugins<Initial, Plugins>>> {
  await runGame(config);
  return {
    ...gameLifecycleAPI,
    get gameContext() {
      return getGameContext<WithPlugins<Initial, Plugins>>();
    },
  };
}

async function runGame<Initial extends object, const Plugins extends readonly unknown[]>(
  options: GameConfig<Initial, Plugins>,
): Promise<void> {
  const { rootElement, initialContext, initialScene } = options;
  const pluginList = (options.plugins ?? []);

  installedContext = undefined;
  flushScheduledDisposes();

  if (initialScene !== undefined) {
    setScene(initialScene);
  }

  const seed: GameContext<Initial> = {
    ...initialContext,
    rootElement,
    dispose,
    initialScene,
    scene: getScene(),
  };
  const hotScopeSnapshot = __suspendHotScopes();
  try {
    installedContext = await reducePlugins(seed, pluginList);
  } finally {
    __restoreHotScopes(hotScopeSnapshot);
  }

  startGameloop();
}
