import { curryLifecycle } from "./lifecycle";
import { curryScene, type SerializableObject } from "./scene";
import { createSelectedObjectsStore } from "./selectedObjectsStore";

export type GameIDEOptions<AdditionalContext> = {
  rootElement: Element;
  initialScene: SerializableObject;
  additionalContext: AdditionalContext;
};

type ContextModule<Input extends object, Output extends object> = (
  context: Input,
) => Output | Promise<Output>;

export type GameRunner<Context extends object> = {
  run<Output extends object>(module: ContextModule<Context, Output>): GameRunner<Context & Output>;

  execute(): Promise<Context>;
};

export const curryRun = <Context extends object>(
  contextPromise: Promise<Context>,
): GameRunner<Context> => {
  return {
    run<Output extends object>(
      module: ContextModule<Context, Output>,
    ): GameRunner<Context & Output> {
      return curryRun(
        contextPromise.then(async (context) => {
          const output = await module(context);

          return {
            ...context,
            ...output,
          };
        }),
      );
    },

    execute(): Promise<Context> {
      return contextPromise;
    },
  };
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
  return { ...curryRun(Promise.resolve(initialContext)), gameContext: initialContext };
};

export type GameContext = ReturnType<typeof gameide>["gameContext"];
