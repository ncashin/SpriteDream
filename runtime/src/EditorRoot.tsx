import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import Editor from "./editor/Editor";
import GameContextProvider from "./editor/GameContextProvider";
import type { GameContext } from "./tomove/initialization";

export type EditorRootOptions = {
  gameContext: GameContext;
};

export default function EditorRoot({ gameContext }: EditorRootOptions) {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <GameContextProvider gameContext={gameContext}>
        <Suspense fallback={<div>Loading...</div>}>
          <Editor />
        </Suspense>
      </GameContextProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
