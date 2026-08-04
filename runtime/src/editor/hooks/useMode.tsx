import type { Mode } from "../../createEditorStore";
import useEditorStore from "./useEditorStore";

export default function useMode() {
  const { value: mode, setState } = useEditorStore((state) => state.mode);

  const setMode = (newMode: Mode) => {
    setState((state) => ({ ...state, mode: newMode }));
  };

  return { mode, setMode };
}
