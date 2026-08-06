import { createContext } from "react";
import { createEditorStore, type EditorStore } from "../createEditorStore";

const editorStoreDefault = await createEditorStore({});
export const EditorStoreContext = createContext(editorStoreDefault);

export default function EditorStoreProvider({
  editorStore,
  children,
}: {
  editorStore: EditorStore;
  children: React.ReactNode;
}) {
  return <EditorStoreContext.Provider value={editorStore}>{children}</EditorStoreContext.Provider>;
}
