import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { GameContext } from "../tomove/gameide";

import Editor from "./Editor";
import GameContextProvider from "./EditorStoreProvider";

export const editorPlugin = () => async (context: GameContext) => {
  const { rootElement } = context;

  const queryClient = new QueryClient();

  const editorRoot = createRoot(rootElement);

    editorRoot.render(
      <QueryClientProvider client={queryClient}>
        <GameContextProvider gameContext={context}>
          <Suspense fallback={<div>Loading...</div>}>
            <Editor />
          </Suspense>
        </GameContextProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>,
    ),
  
  return { ...context };
};
