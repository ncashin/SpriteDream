import { useContext, useSyncExternalStore } from "react";
import type { EditorStoreState } from "../../editorStoreSchema";
import { EditorStoreContext } from "../EditorStoreProvider";

export default function useEditorStore<T>(select: (state: EditorStoreState) => T) {
  const { subscribe, getSnapshot, setState } = useContext(EditorStoreContext);

  const value = useSyncExternalStore(subscribe(select), () => select(getSnapshot()));

  return {
    value,
    setState,
  };
}
