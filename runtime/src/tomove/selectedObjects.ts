import type { Path } from "../createEditorStore";

export const currySelectedObjects = (selectedObjects: Path[]) => ({
  selectedObjects,
  isSelected(key: Path) {
    return selectedObjects.includes(key);
  },

  selectObject(key: Path) {
    if (!selectedObjects.includes(key)) {
      selectedObjects.push(key);
    }
  },

  deselectObject(key: Path) {
    const index = selectedObjects.indexOf(key);

    if (index !== -1) {
      selectedObjects.splice(index, 1);
    }
  },

  deselectObjects() {
    selectedObjects.length = 0;
  },
});
