import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import type { GameContext } from "../initialization";

import { patchScene } from "../scene";
import Editor from "./Editor";
import GameContextProvider from "./GameContextProvider";
import GameViewProvider from "./GameViewProvider";

export const editorPlugin = () => async (context: GameContext) => {
  const { rootElement, scene, onDispose } = context;

  const queryClient = new QueryClient();

  const editorRoot = createRoot(rootElement);

  const { promise: ready, resolve: markReady } = Promise.withResolvers<void>();

  flushSync(() =>
    editorRoot.render(
      <QueryClientProvider client={queryClient}>
        <GameContextProvider gameContext={context}>
          <GameViewProvider onReady={markReady}>
            <Suspense fallback={<div>Loading...</div>}>
              <Editor />
            </Suspense>
          </GameViewProvider>
        </GameContextProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>,
    ),
  );

  await ready;
  const newRootElement = rootElement.querySelector("#game-view");
  invariant(newRootElement, "A <GameView /> Component Must Be Rendered In Editor");

  onDispose(() => {
    editorRoot.unmount();
    queryClient.clear();
  });

  if (import.meta.hot) {
    import.meta.hot.on("gameide:scene", ({ file, content, patch }) => {
      const queryKey = ["files", file];
      queryClient.setQueryData(queryKey, {
        content,
      });
      queryClient.invalidateQueries({ queryKey });

      patchScene(scene, patch);
    });

    import.meta.hot.accept(() => {
      context.__run.rerun();
    });
  }

  return { ...context, rootElement: newRootElement, ready, markReady };
};
