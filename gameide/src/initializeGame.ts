import {
  removeCallbacksForToken,
  runWithToken,
  startGameloop,
} from "./gameloop.js";
import { setScene } from "./scene/scene.js";

/**
 * Loose plugin signature for documentation; `initializePlugins` keeps the
 * concrete tuple so `FinalContext` can merge each plugin’s real return type.
 */
export type Plugin = (input: object) => object | Promise<object>;

type ContextAddedByPlugin<PluginFunction> = PluginFunction extends (
  input: infer In,
) => infer Out
  ? Out extends Promise<infer R>
    ? Omit<R, keyof In>
    : Omit<Out, keyof In>
  : never;

type ReducedContext<PluginList extends readonly unknown[]> =
  PluginList extends readonly [infer First, ...infer Rest]
    ? Rest extends readonly unknown[]
      ? ContextAddedByPlugin<First> & ReducedContext<Rest>
      : ContextAddedByPlugin<First>
    : unknown;

export const initializePlugins = <const Plugins extends readonly unknown[]>(
  plugins: Plugins,
) => plugins;

export type FinalContext<
  InitialContext,
  PluginList extends readonly unknown[],
> = InitialContext & ReducedContext<PluginList>;

type RootContext = {
  rootElement: HTMLElement;
};

async function initializeGame<
  InitialContext,
  const PluginList extends readonly unknown[],
>(options: {
  rootElement: HTMLElement;
  initialContext: InitialContext;
  plugins: PluginList;
  initialScene?: Record<string, unknown>;
  main: (context: FinalContext<InitialContext & RootContext, PluginList>) => void;
}): Promise<FinalContext<InitialContext & RootContext, PluginList>> {
  type ResultContext = FinalContext<InitialContext & RootContext, PluginList>;
  const hot = import.meta.hot;
  let result: ResultContext;

  if (hot?.data?.context !== undefined) {
    result = hot.data.context as ResultContext;
  } else {
    if (import.meta.env.PROD) {
      setScene(options.initialScene);
    }
    result = {
      ...options.initialContext,
      rootElement: options.rootElement,
    } as ResultContext;
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
