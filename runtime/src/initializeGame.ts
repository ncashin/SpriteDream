import {
  clearUpdateScope,
  removeGameUpdatesForScope,
  setUpdateScope,
  startGameloop,
} from "./gameloop";
import { setInitialScene } from "./scene";

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
  initialScene?: Record<string, unknown>;
  main: (ctx: FinalContext<Initial, Plugins>) => void;
};

const MAIN_SCOPE = "main";

function initializeGame<Initial, const Plugins extends readonly [PluginFn, ...PluginFn[]]>(
  options: { initialContext: Initial; plugins: Plugins; initialScene?: Record<string, unknown>; main: (ctx: FinalContext<Initial, Plugins>) => void }
): FinalContext<Initial, Plugins>;
function initializeGame<Initial>(options: { initialContext: Initial; initialScene?: Record<string, unknown>; main: (ctx: Initial) => void }): Initial;
function initializeGame<Initial, Plugins extends readonly PluginFn[]>(
  options: InitializeGameOptions<Initial, Plugins>
): FinalContext<Initial, Plugins> | Initial {
  const hot = import.meta.hot;
  const data = hot?.data as { ctx?: unknown; mainScope?: string } | undefined;
  const isHmr = hot && data?.ctx !== undefined;

  let result: any;

  if (isHmr) {
    result = data!.ctx;
    removeGameUpdatesForScope(data!.mainScope ?? MAIN_SCOPE);
  } else {
    setInitialScene(options.initialScene);

    result = options.initialContext;
    if (Array.isArray(options.plugins)) {
      for (const plugin of options.plugins) {
        if (typeof plugin === "function") {
          result = plugin(result);
        }
      }
    }

    if (hot) {
      (hot.data as { ctx?: unknown; mainScope?: string }).mainScope = MAIN_SCOPE;
    }
    startGameloop();
  }

  setUpdateScope(MAIN_SCOPE);
  options.main(result);
  clearUpdateScope();

  if (hot) {
    (hot.data as { ctx?: unknown }).ctx = result;
  }

  return result;
}

export { initializeGame };
