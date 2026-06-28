import {
  flushDisposeCallbacks,
  startGameloop,
  onStart,
  onUpdate,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  onDispose,
  gameLifecycle,
  GameLifecycle,
} from "./gameloop.js";
import {
  setScene,
  getScene,
  getRawScene,
  type Scene,
  type SceneObject,
} from "../scene/scene.js";
import { reduceGameModules, type ReduceGameModules } from "./gameModule.js";

export type BaseGameContext<Initial extends object = {}> = {
  rootElement: HTMLElement;
  initialScene?: SceneObject;
  scene: Scene;
} & GameLifecycle &
  Initial;

export type GameContext<
  Initial extends object,
  GameModules extends readonly unknown[] = [],
> = ReduceGameModules<BaseGameContext<Initial>, GameModules>;

export type GameIDEOptions<
  Initial extends object,
  GameModules extends readonly unknown[] = [],
> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: SceneObject;
  gameModules: GameModules;
};

export async function gameide<
  Initial extends object,
  const GameModules extends readonly unknown[] = [],
>({
  rootElement,
  initialContext,
  initialScene,
  gameModules,
}: GameIDEOptions<Initial, GameModules>): Promise<
  Readonly<GameContext<Initial, GameModules>>
> {
  flushDisposeCallbacks();

  if (initialScene !== undefined) {
    setScene(initialScene);
  }

  const gameContextBase: BaseGameContext<Initial> = {
    rootElement,
    initialScene,
    scene: getScene(),
    getScene,
    getRawScene,
    setScene,
    ...gameLifecycle,
    ...initialContext,
  };

  const context = await reduceGameModules(gameContextBase, gameModules);

  startGameloop();
  return context;
}
