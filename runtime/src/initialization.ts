import { curryLifecycle, type LifecycleAPI } from "./lifecycle";
import { curryScene, type SerializableObject } from "./scene";
import { createSelectedObjectsStore } from "./selectedObjectsStore";

export type GameIDEOptions<AdditionalContext> = {
  rootElement: HTMLElement;
  initialScene: SerializableObject;
  additionalContext: AdditionalContext;
};

type ContextModule<Input extends RunnableContext, Output extends object> = (
  context: Input,
) => Output | Promise<Output>;

type RunInfo = {
  id: number;
  scope: string;
  rerun: (module?: ContextModule<any, any>) => Promise<void>;
  rerunAfter: (context: Partial<RunnableContext>) => Promise<void>;
};

type RunnableContext = LifecycleAPI & {
  __run?: RunInfo;
};

type PipelineStep = {
  id: number;
  module: ContextModule<any, any>;
};

export type GameRunner<Context extends RunnableContext> = {
  run<Output extends object>(module: ContextModule<Context, Output>): GameRunner<Context & Output>;

  execute(): Promise<Context>;
};

export const curryRun = <Context extends RunnableContext>(
  contextPromise: Promise<Context>,
  steps: PipelineStep[] = [],
): GameRunner<Context> => {
  return {
    run<Output extends object>(
      module: ContextModule<Context, Output>,
    ): GameRunner<Context & Output> {
      const step: PipelineStep = {
        id: steps.length,
        module,
      };

      const nextSteps = [...steps, step];

      return curryRun(
        contextPromise.then(async (context) => {
          const runPipeline = async (startIndex: number, initialContext: RunnableContext) => {
            let nextContext = initialContext;

            for (
              let cleanupStepIndex = nextSteps.length - 1;
              cleanupStepIndex >= startIndex;
              cleanupStepIndex--
            ) {
              await nextContext.cleanupCallbacksByScope(`run:${cleanupStepIndex}`);
            }

            for (
              let replayStepIndex = startIndex;
              replayStepIndex < nextSteps.length;
              replayStepIndex++
            ) {
              const replayStep = nextSteps[replayStepIndex];

              const rerun = async (updatedModule?: ContextModule<any, any>) => {
                if (updatedModule) {
                  replayStep.module = updatedModule;
                }

                await runPipeline(replayStepIndex, nextContext);
              };

              const rerunAfter = async (updatedContext: Partial<RunnableContext>) => {
                await runPipeline(replayStepIndex + 1, {
                  ...nextContext,
                  ...updatedContext,
                });
              };

              const runInfo: RunInfo = {
                id: replayStepIndex,
                scope: `run:${replayStepIndex}`,
                rerun,
                rerunAfter,
              };

              nextContext.setScope(runInfo.scope);

              const output = await replayStep.module({
                ...nextContext,
                __run: runInfo,
              });

              nextContext = {
                ...nextContext,
                __run: runInfo,
                ...output,
              };
            }

            return nextContext;
          };

          return runPipeline(step.id, context);
        }),
        nextSteps,
      );
    },

    execute() {
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

  return {
    ...curryRun(Promise.resolve(initialContext)),
    gameContext: initialContext,
  };
};

export type GameContext = ReturnType<typeof gameide>["gameContext"];
