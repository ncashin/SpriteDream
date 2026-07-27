import { useSyncExternalStore } from "react";
import type { SerializableObject } from "./scene";

type SelectedObject = {
  key: string;
  object: SerializableObject;
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

export const selectObject = (key: string, object: SerializableObject) => {
  selectedObjects = [...selectedObjects, { key, object }];
  emit();
};

export const deselectObject = (object: SerializableObject) => {
  selectedObjects = selectedObjects.filter((selected) => !(selected.object === object));

  emit();
};
export const deselectObjects = () => {
  selectedObjects = [];
  emit();
};

export const useSelectedObjects = () =>
  useSyncExternalStore(subscribeToSelectedObjects, getSelectedObjects, getSelectedObjects);
