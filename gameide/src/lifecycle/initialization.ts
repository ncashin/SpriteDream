import {
  flushDisposeCallbacks,
  startGameloop,
  gameLifecycle,
  GameLifecycle,
} from "./gameloop.js";
import { curryScene, type Scene, type SceneObject } from "../scene/scene.js";
import {
  reduceGameModules,
  type ReduceGameModules,
  type UnknownGameModule,
} from "./gameModule.js";

export type BaseGameContext<Initial extends object = {}> = {
  rootElement: HTMLElement;
  initialScene?: SceneObject;
  scene: Scene;
} & GameLifecycle &
  Initial;

export type GameContext<
  Initial extends object = {},
  GameModules extends readonly UnknownGameModule[] = [],
> = ReduceGameModules<BaseGameContext<Initial>, GameModules>;

export type GameIDEOptions<
  Initial extends object,
  GameModules extends readonly UnknownGameModule[] = [],
> = {
  rootElement: HTMLElement;
  initialContext: Initial;
  initialScene?: SceneObject;
  gameModules: GameModules;
};

export async function gameide<
  Initial extends object,
  const GameModules extends readonly UnknownGameModule[] = [],
>({
  rootElement,
  initialContext,
  initialScene,
  gameModules,
}: GameIDEOptions<Initial, GameModules>): Promise<
  Readonly<GameContext<Initial, GameModules>>
> {
  flushDisposeCallbacks();

  const scene = curryScene(initialScene ? structuredClone(initialScene) : {});

  const gameContextBase: BaseGameContext<Initial> = {
    rootElement,

    initialScene,
    scene,

    ...gameLifecycle,
    ...initialContext,
  };

  const context = await reduceGameModules(gameContextBase, gameModules);

  startGameloop();
  return context;
}
