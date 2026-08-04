import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import { createEditorStore } from "./createEditorStore";
import Editor from "./editor/Editor";
import EditorStoreProvider from "./editor/EditorStoreProvider";
import type { GameContext } from "./tomove/initialization";

export type EditorRootOptions = {
  gameContext: GameContext;
};

export default function EditorRoot() {
  const queryClient = new QueryClient();

  const editorStore = createEditorStore();
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
