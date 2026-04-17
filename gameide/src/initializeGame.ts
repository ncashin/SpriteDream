import {
  removeCallbacksForToken,
  runWithToken,
  startGameloop,
} from "./gameloop.js";
import { setScene } from "./scene/scene.js";

export type Plugin = (input: object) => object | Promise<object>;

type PluginAddedFields<F> = F extends (input: infer In) => infer Out
  ? Out extends Promise<infer Resolved>
    ? Omit<Resolved, keyof In>
    : Omit<Out, keyof In>
  : never;

type IntersectPluginFields<Plugins extends readonly unknown[]> =
  Plugins extends readonly [infer Head, ...infer Tail]
    ? Tail extends readonly unknown[]
      ? PluginAddedFields<Head> & IntersectPluginFields<Tail>
      : PluginAddedFields<Head>
    : unknown;

export const initializePlugins = <const Plugins extends readonly unknown[]>(
  plugins: Plugins,
) => plugins;

export type FinalContext<
  InitialContext,
  PluginList extends readonly unknown[],
> = InitialContext & IntersectPluginFields<PluginList>;

type RootContext = {
  rootElement: HTMLElement;
};

type InitializedContext<
  InitialContext,
  PluginList extends readonly unknown[],
> = FinalContext<InitialContext & RootContext, PluginList>;

async function initializeGame<
  InitialContext,
  const PluginList extends readonly unknown[],
>(options: {
  rootElement: HTMLElement;
  initialContext: InitialContext;
  plugins: PluginList;
  initialScene?: Record<string, unknown>;
  main: (context: InitializedContext<InitialContext, PluginList>) => void;
}): Promise<InitializedContext<InitialContext, PluginList>> {
  type ResultContext = InitializedContext<InitialContext, PluginList>;
  const hot = import.meta.hot;
  const restored = hot?.data?.context as ResultContext | undefined;

  let result: ResultContext =
    restored ??
    ({
      ...options.initialContext,
      rootElement: options.rootElement,
    } as ResultContext);

  if (!restored) {
    if (options.initialScene !== undefined) {
      setScene(options.initialScene);
    }
    for (const plugin of options.plugins ?? []) {
      const next =
        typeof plugin === "function" ? plugin(result) : result;
      result = (await next) as ResultContext;
    }
  }

  if (hot) {
    if (hot.data.runToken !== undefined) {
      removeCallbacksForToken(hot.data.runToken);
    }
    hot.data.runToken = runWithToken(() => options.main(result));
    hot.data.context = result;
  } else {
    runWithToken(() => options.main(result));
  }

  if (!restored) {
    startGameloop();
  }

  return result;
}

export { initializeGame };
