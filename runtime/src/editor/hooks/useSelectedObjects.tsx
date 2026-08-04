import type { Path } from "../../createEditorStore";
import useEditorStore from "./useEditorStore";

export default function useSelectedObjects() {
  const { value: selectedObjects, setState } = useEditorStore((state) => state.selectedObjects);

  const isSelected = (key: Path) => {
    return selectedObjects.some((selected) => selected === key);
  };

  const selectObject = (key: Path) => {
    if (!isSelected(key)) {
      setState((state) => ({ ...state, selectedObjects: [...selectedObjects, key] }));
    }
  };

  const deselectObject = (key: Path) => {
    setState((state) => ({
      ...state,
      selectedObjects: selectedObjects.filter((selected) => selected !== key),
    }));
  };

  const deselectObjects = () => {
    setState((state) => ({ ...state, selectedObjects: [] }));
  };

  return {
    selectedObjects,
    isSelected,
    selectObject,
    deselectObject,
    deselectObjects,
  };
}
