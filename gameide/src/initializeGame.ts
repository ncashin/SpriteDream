import {
  clearUpdateScope,
  removeGameUpdatesForScope,
  setUpdateScope,
  startGameloop,
} from "./gameloop.js";
import { setInitialScene } from "./scene.js";

export type Plugin = (input: any) => any;

type ContextAddedByPlugin<PluginFunction> = PluginFunction extends (input: infer In) => infer Out
  ? Omit<Out, keyof In>
  : never;

type ReducedContext<PluginList extends readonly Plugin[]> =
  PluginList extends readonly [infer First, ...infer Rest]
    ? Rest extends readonly Plugin[]
      ? ContextAddedByPlugin<First> & ReducedContext<Rest>
      : ContextAddedByPlugin<First>
    : unknown;

export type FinalContext<
  InitialContext,
  PluginList extends readonly Plugin[],
> = InitialContext & ReducedContext<PluginList>;

const MAIN_SCOPE = "main";

function initializeGame<
  InitialContext,
  const PluginList extends readonly Plugin[],
>(options: {
  initialContext: InitialContext;
  plugins: PluginList;
  initialScene?: Record<string, unknown>;
  main: (context: FinalContext<InitialContext, PluginList>) => void;
}): FinalContext<InitialContext, PluginList> {
  type ResultContext = FinalContext<InitialContext, PluginList>;
  let result: ResultContext;

  if (import.meta.hot && import.meta.hot.data?.context !== undefined) {
    result = import.meta.hot.data.context;
    removeGameUpdatesForScope(import.meta.hot.data.mainScope);
    setUpdateScope(MAIN_SCOPE);
    options.main(result);
    clearUpdateScope();
    import.meta.hot.data.context = result;
    return result;
  }

  if (import.meta.env.PROD) {
    setInitialScene(options.initialScene);
  }

  result = options.initialContext as ResultContext;
  if (Array.isArray(options.plugins)) {
    result = options.plugins.reduce(
      (ctx, plugin) => (typeof plugin === "function" ? plugin(ctx) : ctx),
      result
    ) as ResultContext;
  }

  if (import.meta.hot) {
    import.meta.hot.data.mainScope = MAIN_SCOPE;
  }
  startGameloop();

  setUpdateScope(MAIN_SCOPE);
  options.main(result);
  clearUpdateScope();
  if (import.meta.hot) {
    import.meta.hot.data.context = result;
  }
  return result;
}

export { initializeGame };
