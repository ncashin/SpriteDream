import {
  flushScheduledDisposes,
  startGameloop,
  onStart,
  onUpdate,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  dispose,
} from "./gameloop.js";
import { __suspendHotScopes, __restoreHotScopes } from "./gameloopHMR.js";
import {
  setScene,
  getScene,
  getRawScene,
  type Scene,
  type SceneObject,
} from "../scene/scene.js";
import { reduceGameModules, type GameModule, type ReduceGameModules } from "./gameModule.js";

export type DisposeCallback = (callback: () => void) => void;

export type GameLifecycle = {
  readonly onStart: typeof onStart;
  readonly onUpdate: typeof onUpdate;
  readonly onGameStart: typeof onGameStart;
  readonly onGameUpdate: typeof onGameUpdate;
  readonly onEditorStart: typeof onEditorStart;
  readonly onEditorUpdate: typeof onEditorUpdate;
  readonly getScene: typeof getScene;
  readonly getRawScene: typeof getRawScene;
  readonly setScene: typeof setScene;
};

export type BaseGameContext = GameLifecycle & {
  rootElement: HTMLElement;
  initialScene?: SceneObject;
  scene: Scene;
  dispose: DisposeCallback;
};

export type GameContext<
  Initial extends object,
  GameModules extends readonly unknown[],
> = ReduceGameModules<Initial & BaseGameContext, GameModules>;

export type GameIDEOptions<
  Initial extends object,
  GameModules extends readonly unknown[],
> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: SceneObject;
  gameModules?: GameModules;
};

const gameLifecycle: GameLifecycle = {
  onStart,
  onUpdate,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  getScene,
  getRawScene,
  setScene,
};

export async function gameide<
  Initial extends object,
  const GameModules extends readonly unknown[],
>(
  config: GameIDEOptions<Initial, GameModules>,
): Promise<GameContext<Initial, GameModules>> {
  return runGame(config);
}

async function runGame<
  Initial extends object,
  const GameModules extends readonly unknown[],
>(
  options: GameIDEOptions<Initial, GameModules>,
): Promise<GameContext<Initial, GameModules>> {
  const { rootElement, initialContext, initialScene } = options;
  const gameModuleList = options.gameModules ?? [];

  flushScheduledDisposes();

  if (initialScene !== undefined) {
    setScene(initialScene);
  }

  const seed = {
    ...initialContext,
    ...gameLifecycle,
    rootElement,
    dispose,
    initialScene,
    scene: getScene(),
  };
  const hotScopeSnapshot = __suspendHotScopes();
  let context: GameContext<Initial, GameModules>;
  try {
    context = (await reduceGameModules(
      seed,
      gameModuleList as readonly GameModule<any, any>[],
    )) as GameContext<Initial, GameModules>;
  } finally {
    __restoreHotScopes(hotScopeSnapshot);
  }

  startGameloop();
  return context;
}
