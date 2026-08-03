import { curryLifecycle, type LifecycleAPI } from "./lifecycle";
import { curryScene, type SerializableObject } from "./scene";
import { createSelectedObjectsStore } from "./selectedObjectsStore";

export type GameIDEOptions<AdditionalContext> = {
  rootElement: HTMLElement;
  initialScene: SerializableObject;
  additionalContext: AdditionalContext;
};

type PluginModule<Context extends RunnableContext, Output extends object> = (
  context: Context & { __run: RunInfo },
) => Output | Promise<Output>;

export type RunInfo = {
  id: number;
  scope: string;
  rerun: (module?: PluginModule<any, any>) => Promise<void>;
  rerunAfter: (patch: object) => Promise<void>;
};

type RunnableContext = LifecycleAPI & {
  __run?: RunInfo;
};

type Plugin = PluginModule<any, any>;

async function runPipeline(
  steps: Plugin[],
  fromIndex: number,
  context: RunnableContext,
  patch?: object,
): Promise<RunnableContext> {
  let ctx = patch ? { ...context, ...patch } : context;

  for (let i = steps.length - 1; i >= fromIndex; i--) {
    await ctx.cleanupCallbacksByScope(`run:${i}`);
  }

  for (let i = fromIndex; i < steps.length; i++) {
    const scope = `run:${i}`;
    const contextBeforeStep = ctx;

    const __run: RunInfo = {
      id: i,
      scope,
      rerun: async (module) => {
        if (module) steps[i] = module;
        await runPipeline(steps, i, contextBeforeStep);
      },
      rerunAfter: async (p) => {
        await runPipeline(steps, i + 1, contextBeforeStep, p);
      },
    };

    ctx.setScope(scope);

    const output = await steps[i]({ ...ctx, __run });
    ctx = { ...ctx, __run, ...output };
  }

  return ctx;
}

export type GameRunner<Context extends RunnableContext = RunnableContext> = {
  run<Output extends object>(
    module: PluginModule<Context, Output>,
  ): GameRunner<Context & Output>;
  execute: () => Promise<Context>;
};

function createRunner<Context extends RunnableContext>(
  initialContext: Context,
): GameRunner<Context> {
  const steps: Plugin[] = [];
  let contextPromise: Promise<RunnableContext> = Promise.resolve(initialContext);

  return {
    run<Output extends object>(module: PluginModule<Context, Output>) {
      const fromIndex = steps.length;
      steps.push(module);
      contextPromise = contextPromise.then((ctx) => runPipeline(steps, fromIndex, ctx));
      return this as GameRunner<Context & Output>;
    },

    execute() {
      return contextPromise as Promise<Context>;
    },
  };
}

export const gameide = <AdditionalContext>({
  rootElement,
  initialScene,
  additionalContext,
}: GameIDEOptions<AdditionalContext>) => {
  const lifecycle = curryLifecycle();

  const selectedObjectsStore = createSelectedObjectsStore();

  const sceneAPI = curryScene(initialScene, {
    onSetScene: () => {
      selectedObjectsStore.deselectObjects();
    },
  });

  const isEditor = !!import.meta.hot;

  const initialContext = {
    isEditor,
    rootElement,

    selectedObjectsStore,
    ...sceneAPI,

    ...lifecycle,
    ...additionalContext,
  };

  lifecycle.start();

  return {
    ...createRunner(initialContext),
    gameContext: initialContext,
  };
};

export type GameContext = ReturnType<typeof gameide>["gameContext"] & {
  __run?: RunInfo;
};
