import invariant from "tiny-invariant";
import type { GameContext, Plugin } from "./plugin";

type ContextAfter<P> = P extends (ctx: any) => infer R
  ? R extends Promise<infer X>
    ? X
    : R
  : never;

type FullContext<Plugins> = Plugins extends readonly [...any[], infer Last]
  ? ContextAfter<Last>
  : GameContext;

export type InitializeGameOptions<Plugins extends readonly Plugin[] = []> = {
  initialContext?: GameContext;
  main: (ctx: FullContext<Plugins>) => void | Promise<void>;
  plugins?: Plugins;
};

export const initializeGame = async <const Plugins extends readonly Plugin[] = []>(
  options: InitializeGameOptions<Plugins>
) => {
  const initialContext = options.initialContext ?? ({} as GameContext);
  invariant(
    initialContext.__gameRoot,
    "#game element must exist in the DOM"
  );
  invariant(
    typeof initialContext.__isRunning === "boolean",
    "initialContext.__isRunning must be a boolean"
  );
  let context: GameContext = initialContext;
  for (const plugin of options.plugins ?? []) {
    context = await plugin(context);
  }
  await options.main(context as FullContext<Plugins>);
};
