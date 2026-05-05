import { Play, Square } from "lucide-react";
import { useState, useEffect } from "react";
import { GameIDEMode, getMode, setMode, onModeChange } from "../../lifecycle/mode.js";
import { OverlayButton } from "./OverlayButton.js";

function useMode() {
  const [mode, setModeState] = useState(getMode());
  useEffect(() => {
    return onModeChange(() => setModeState(getMode()));
  }, []);
  return mode;
}

export function RunButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const mode = useMode();
  const isRunning = mode === GameIDEMode.Game;

  return (
    <OverlayButton
      variant={isRunning ? "danger" : "default"}
      onClick={() =>
        setMode(isRunning ? GameIDEMode.Editor : GameIDEMode.Game)
      }
      title={isRunning ? "Stop" : "Run"}
      className={className}
      {...props}
    >
      {isRunning ? (
        <>
          <Square size={12} aria-hidden />
          Stop
        </>
      ) : (
        <>
          <Play size={12} aria-hidden />
          Run
        </>
      )}
    </OverlayButton>
  );
}
