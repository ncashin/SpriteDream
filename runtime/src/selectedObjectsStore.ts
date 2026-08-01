import type { SerializableObject } from "./scene";

export type SelectedObject = {
  key: string;
  object: SerializableObject;
};

export type SelectedObjectsStore = ReturnType<typeof createSelectedObjectsStore>;

export function createSelectedObjectsStore() {
  let selectedObjects: SelectedObject[] = [];
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const getSnapshot = () => selectedObjects;

  const isSelected = (key: string) => {
    return selectedObjects.some((selected) => selected.key === key);
  };

  const selectObject = (key: string, object: SerializableObject) => {
    console.log("HIT");

    if (!isSelected(key)) {
      selectedObjects = [...selectedObjects, { key, object }];
      emit();
    }
  };

  const deselectObject = (object: SerializableObject) => {
    selectedObjects = selectedObjects.filter(
      (selected) => selected.object !== object
    );

    emit();
  };

  const deselectObjects = () => {
    selectedObjects = [];
    emit();
  };

  return {
    subscribe,
    getSnapshot,
    selectObject,
    deselectObject,
    deselectObjects,
    isSelected,
  };
}