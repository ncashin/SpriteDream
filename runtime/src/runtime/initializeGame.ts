import type { GameContext, Plugin } from "./plugin";

type ContextAfter<P> = P extends (ctx: any) => infer R ? R : never;

type FullContext<Plugins> = Plugins extends readonly [...any[], infer Last]
  ? ContextAfter<Last>
  : GameContext;

export type InitializeGameOptions<Plugins extends readonly Plugin[] = []> = {
  main: (ctx: FullContext<Plugins>) => void;
  plugins?: Plugins;
};

export const initializeGame = <const Plugins extends readonly Plugin[] = []>(
  options: InitializeGameOptions<Plugins>
) => {
  const initialContext = {} as GameContext;
  const ctx = (options.plugins ?? []).reduce(
    (acc, plugin) => plugin(acc),
    initialContext
  ) as FullContext<Plugins>;
  options.main(ctx);
};
