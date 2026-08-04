import { useContext, useSyncExternalStore } from "react";
import type { EditorStore } from "../../createEditorStore";
import { EditorStoreContext } from "../EditorStoreProvider";

export default function useEditorStore<T>(select: (state: EditorStore) => T) {
  const { subscribe, getSnapshot, setState } = useContext(EditorStoreContext);

  const value = useSyncExternalStore(subscribe(select), () => select(getSnapshot()));

  return {
    value,
    setState,
  };
}
