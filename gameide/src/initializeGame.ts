import {
  clearUpdateScope,
  removeGameUpdatesForScope,
  setUpdateScope,
  startGameloop,
} from "./gameloop.js";
import { setInitialScene } from "./scene.js";

export type Plugin<T = unknown> = (input: T) => T;

type PluginFunction = (input: any) => any;

type PluginAdds<P> = P extends (input: infer I) => infer O ? Omit<O, keyof I> : never;

type ReducePlugins<Ps extends readonly PluginFunction[]> = Ps extends readonly [infer P, ...infer Rest]
  ? P extends PluginFunction
    ? Rest extends readonly PluginFunction[]
      ? PluginAdds<P> & ReducePlugins<Rest>
      : PluginAdds<P>
    : unknown
  : unknown;

export type FinalContext<Initial, Plugins extends readonly PluginFunction[]> = Initial & ReducePlugins<Plugins>;

export type InitializeGameOptions<
  Initial = unknown,
  Plugins extends readonly PluginFunction[] = readonly []
> = {
  plugins?: Plugins;
  initialContext: Initial;
  initialScene?: Record<string, unknown>;
  main: (context: FinalContext<Initial, Plugins>) => void;
};

const MAIN_SCOPE = "main";

function initializeGame<Initial, const Plugins extends readonly [PluginFunction, ...PluginFunction[]]>(
  options: { initialContext: Initial; plugins: Plugins; initialScene?: Record<string, unknown>; main: (context: FinalContext<Initial, Plugins>) => void }
): FinalContext<Initial, Plugins>;
function initializeGame<Initial>(options: { initialContext: Initial; initialScene?: Record<string, unknown>; main: (context: Initial) => void }): Initial;
function initializeGame<Initial, Plugins extends readonly PluginFunction[]>(
  options: InitializeGameOptions<Initial, Plugins>
): FinalContext<Initial, Plugins> | Initial {
  const hot = typeof import.meta !== "undefined" ? import.meta.hot : undefined;
  const data = hot?.data as { context?: unknown; mainScope?: string } | undefined;
  const isHotModuleReplacement = hot !== undefined && data?.context !== undefined;

  let result: any;

  if (isHotModuleReplacement) {
    result = data?.context;
    removeGameUpdatesForScope(data?.mainScope ?? MAIN_SCOPE);
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
      (hot.data as { context?: unknown; mainScope?: string }).mainScope = MAIN_SCOPE;
    }
    startGameloop();
  }

  setUpdateScope(MAIN_SCOPE);
  options.main(result);
  clearUpdateScope();

  if (hot) {
    (hot.data as { context?: unknown }).context = result;
  }

  return result;
}

export { initializeGame };
