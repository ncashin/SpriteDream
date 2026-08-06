import { createEditorStore, Mode } from "../createEditorStore";
import { createIFrameTransport } from "../createIFrameTransport";
import { curryLifecycle } from "./lifecycle";
import { curryScene, type SerializableObject } from "./scene";
import { currySelectedObjects } from "./selectedObjects";

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
  const contextPromise = (async () => {
    const lifecycle = curryLifecycle();

    const transport = createIFrameTransport(window.parent, {
      targetOrigin: window.location.origin,
    });

    const editorStore = await createEditorStore({
      transport,
      awaitInitialization: true,
    });

    const sceneAPI = curryScene(editorStore.state.scene, {
      onSetScene: () => {},
    });
    const selectedObjectsAPI = currySelectedObjects(editorStore.state.selectedObjects);

    const initialContext = {
      isEditor: editorStore.state.mode === Mode.Editor,
      rootElement,

      ...sceneAPI,
      ...selectedObjectsAPI,

      ...lifecycle,
      ...additionalContext,
    };

    lifecycle.onUpdate(() => {
      editorStore.emit();
    });
    lifecycle.start();

    return initialContext;
  })();

  return createRunner(contextPromise);
};

export type GameContext =
  Parameters<typeof gameide>[0] extends GameIDEOptions<infer AdditionalContext>
    ? ReturnType<typeof gameide<AdditionalContext>> extends GameRunner<infer Context>
      ? Context
      : never
    : never;
