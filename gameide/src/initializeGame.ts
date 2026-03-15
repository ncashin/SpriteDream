import {
  removeCallbacksForToken,
  runWithToken,
  startGameloop,
} from "./gameloop.js";
import { setInitialScene } from "./scene.js";

export type Plugin = (input: any) => any | Promise<any>;

type ContextAddedByPlugin<PluginFunction> = PluginFunction extends (
  input: infer In,
) => infer Out
  ? Out extends Promise<infer R>
    ? Omit<R, keyof In>
    : Omit<Out, keyof In>
  : never;

type ReducedContext<PluginList extends readonly Plugin[]> =
  PluginList extends readonly [infer First, ...infer Rest]
    ? Rest extends readonly Plugin[]
      ? ContextAddedByPlugin<First> & ReducedContext<Rest>
      : ContextAddedByPlugin<First>
    : unknown;

export const gameidePlugins = <const Plugins extends readonly Plugin[]>(
  plugins: Plugins,
) => plugins;

export type FinalContext<
  InitialContext,
  PluginList extends readonly Plugin[],
> = InitialContext & ReducedContext<PluginList>;

async function initializeGame<
  InitialContext,
  const PluginList extends readonly Plugin[],
>(options: {
  initialContext: InitialContext;
  plugins: PluginList;
  initialScene?: Record<string, unknown>;
  main: (context: FinalContext<InitialContext, PluginList>) => void;
}): Promise<FinalContext<InitialContext, PluginList>> {
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
      for (const plugin of options.plugins) {
        const fn =
          typeof plugin === "function" ? plugin : (ctx: unknown) => ctx;
        result = (await Promise.resolve(fn(result))) as ResultContext;
      }
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
