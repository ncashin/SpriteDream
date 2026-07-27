import { useSyncExternalStore } from "react";
import type { GameObject } from "./scene";

type SelectedObject = {
  key: PropertyKey;
  object: GameObject;
};

let selectedObjects: SelectedObject[] = [];

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeToSelectedObjects = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const getSelectedObjects = () => selectedObjects;

export const selectObject = (key: PropertyKey, object: GameObject) => {
  selectedObjects = [...selectedObjects, { key, object }];
  emit();
};

export const deselectObject = (object: GameObject) => {
  selectedObjects = selectedObjects.filter((selected) => !(selected.object === object));

  emit();
};
export const deselectObjects = () => {
  selectedObjects = [];
  emit();
};

export const useSelectedObjects = () =>
  useSyncExternalStore(subscribeToSelectedObjects, getSelectedObjects, getSelectedObjects);
