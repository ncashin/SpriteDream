import { useSyncExternalStore } from "react";
import { getSelectedObjects, subscribeToSelectedObjects } from "../selectedObject";

export const useSelectedObjects = () => {
  return useSyncExternalStore(subscribeToSelectedObjects, getSelectedObjects);
};
