import { curryLifecycle } from "./lifecycle";
import { curryScene, type SerializableObject } from "./scene";
import { createSelectedObjectsStore } from "./selectedObjectsStore";

type PluginModule<Context, Output extends object> = (context: Context) => Output | Promise<Output>;

export type GameRunner<Context> = PromiseLike<{
  gameContext: Context;
}> & {
  gameContext: Context;

  run<Output extends object>(module: PluginModule<Context, Output>): GameRunner<Context & Output>;
};

function createRunner<Context>(contextPromise: Promise<Context>): GameRunner<Context> {
  const runner: GameRunner<Context> = {
    gameContext: undefined as unknown as Context,

    // oxlint-disable-next-line unicorn/no-thenable
    then<TResult1 = { gameContext: Context }, TResult2 = never>(
      onfulfilled?: ((value: { gameContext: Context }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return contextPromise.then(
        (context) => onfulfilled?.({ gameContext: context }) as TResult1,
        onrejected,
      );
    },

    run<Output extends object>(
      module: PluginModule<Context, Output>,
    ): GameRunner<Context & Output> {
      const nextContext = contextPromise.then(async (context) => {
        const output = await module(context);

        return {
          ...context,
          ...output,
        };
      });

      return createRunner(nextContext);
    },
  };

  return runner;
}

export type GameIDEOptions<AdditionalContext> = {
  rootElement: HTMLElement;
  initialScene: SerializableObject;
  additionalContext: AdditionalContext;
};

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

  const initialContext = {
    isEditor: !!import.meta.hot,
    rootElement,

    selectedObjectsStore,
    ...sceneAPI,

    ...lifecycle,
    ...additionalContext,
  };

  lifecycle.start();

  return createRunner(Promise.resolve(initialContext));
};

export type GameContext =
  Parameters<typeof gameide>[0] extends GameIDEOptions<infer AdditionalContext>
    ? ReturnType<typeof gameide<AdditionalContext>> extends GameRunner<infer Context>
      ? Context
      : never
    : never;
