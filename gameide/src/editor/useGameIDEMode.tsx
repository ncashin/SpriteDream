import { useEffect, useState } from "react";
import { GameIDEMode, getMode, onModeChange } from "../lifecycle/mode.js";

export function useGameIDEMode() {
  const [mode, setModeState] = useState(getMode());

  useEffect(() => {
    return onModeChange(() => setModeState(getMode()));
  }, []);

  return mode;
}

