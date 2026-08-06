import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import type { EditorStore } from "./createEditorStore";
import Editor from "./editor/Editor";
import EditorStoreProvider from "./editor/EditorStoreProvider";
import type { GameContext } from "./tomove/gameide";

export type EditorRootOptions = {
  gameContext: GameContext;
};

export default function EditorRoot({ editorStore }: { editorStore: EditorStore }) {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <EditorStoreProvider editorStore={editorStore}>
        <Suspense fallback={<div>Loading...</div>}>
          <Editor />
        </Suspense>
      </EditorStoreProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
