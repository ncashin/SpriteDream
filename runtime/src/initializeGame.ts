import { startGameloop } from "./gameloop";

export type Plugin<T = unknown> = (input: T) => T;

type PluginFn = (input: any) => any;

/** What plugin P adds: (input: I) => O adds Omit<O, keyof I>. */
type PluginAdds<P> = P extends (input: infer I) => infer O ? Omit<O, keyof I> : never;

/** Reduce over plugins: merge each plugin's added shape. */
type ReducePlugins<Ps extends readonly PluginFn[]> = Ps extends readonly [infer P, ...infer Rest]
  ? P extends PluginFn
    ? Rest extends readonly PluginFn[]
      ? PluginAdds<P> & ReducePlugins<Rest>
      : PluginAdds<P>
    : unknown
  : unknown;

export type FinalContext<Initial, Plugins extends readonly PluginFn[]> = Initial & ReducePlugins<Plugins>;

export type InitializeGameOptions<
  Initial = unknown,
  Plugins extends readonly PluginFn[] = readonly []
> = {
  plugins?: Plugins;
  initialContext: Initial;
  main: (ctx: FinalContext<Initial, Plugins>) => void;
};

function initializeGame<Initial, const Plugins extends readonly [PluginFn, ...PluginFn[]]>(
  options: { initialContext: Initial; plugins: Plugins; main: (ctx: FinalContext<Initial, Plugins>) => void }
): void;
function initializeGame<Initial>(options: { initialContext: Initial; main: (ctx: Initial) => void }): void;
function initializeGame<Initial, Plugins extends readonly PluginFn[]>(
  options: InitializeGameOptions<Initial, Plugins>
): void {
  let result: any = options.initialContext;
  if (Array.isArray(options.plugins)) {
    for (const plugin of options.plugins) {
      if (typeof plugin === "function") {
        result = plugin(result);
      }
    }
  }

  options.main(result);

  startGameloop();
}

export { initializeGame };
