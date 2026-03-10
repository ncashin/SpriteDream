import {
  removeCallbacksForToken,
  runWithToken,
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
  const hot = import.meta.hot;
  let result: ResultContext;

  if (hot?.data?.context !== undefined) {
    result = hot.data.context as ResultContext;
  } else {
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
    startGameloop();
  }

  if (hot) {
    if (hot.data.runToken !== undefined) {
      removeCallbacksForToken(hot.data.runToken as string);
    }
    const token = runWithToken(() => options.main(result));
    hot.data.runToken = token;
    hot.data.context = result;
  } else {
    runWithToken(() => options.main(result));
  }

  return result;
}

export { initializeGame };
