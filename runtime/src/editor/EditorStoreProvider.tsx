import { createContext } from "react";
import { createEditorStore } from "../createEditorStore";

export const EditorStoreContext = createContext(createEditorStore());

export default function EditorStoreProvider({
  editorStore,
  children,
}: {
  editorStore: ReturnType<typeof createEditorStore>;
  children: React.ReactNode;
}) {
  return <EditorStoreContext.Provider value={editorStore}>{children}</EditorStoreContext.Provider>;
}
