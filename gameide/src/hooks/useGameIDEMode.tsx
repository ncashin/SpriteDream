import { useSyncExternalStore } from "react";
import {
  GameIDEMode,
  getMode,
  onModeChange,
} from "../lifecycle/mode.js";

export function useGameIDEMode() {
  return useSyncExternalStore(onModeChange, getMode, getMode);
}
