import invariant from "tiny-invariant";
import { syncIFrameScene } from "../iframe/iframe";
import { runEditorUpdateLoop, runUpdateLoop } from "./gameloop";
import type { GameContext, Plugin } from "./plugin";

/** Infer return type of a plugin (use `any` for param so contravariance doesn't produce never). */
type ContextAfter<P> = P extends (context: any) => infer R
  ? R extends Promise<infer X>
    ? X
    : R
  : GameContext;

/** Union of all plugin return types so context has every plugin's additions (e.g. input, viewport). */
type FullContext<Plugins> = Plugins extends readonly [infer First, ...infer Rest]
  ? ContextAfter<First> & FullContext<Rest>
  : Plugins extends readonly []
    ? GameContext
    : GameContext;

export type InitializeGameOptions<Plugins extends readonly Plugin[] = []> = {
  initialContext?: Partial<GameContext>;
  main: (context: FullContext<Plugins>) => void | Promise<void>;
  plugins?: Plugins;
};

export const initializeGame = async <const Plugins extends readonly Plugin[] = []>(
  options: InitializeGameOptions<Plugins>
) => {
  if (!import.meta.env.PROD && window.parent !== window) {
    syncIFrameScene({
      targetWindow: window.parent,
      origin: "*",
      sendInitialState: true,
    });
  }

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

  let lastTime = performance.now();
  const tick = (now: number) => {
    const delta = now - lastTime;
    runUpdateLoop(delta);
    runEditorUpdateLoop(delta);
    lastTime = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
