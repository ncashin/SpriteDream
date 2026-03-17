import { Play, Square } from "lucide-react";
import { useState, useEffect } from "react";
import { GameIDEMode, getMode, setMode, onModeChange } from "../mode.js";
import { cn } from "../utils/cn.js";

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
    <button
      type="button"
      onClick={() =>
        setMode(isRunning ? GameIDEMode.Editor : GameIDEMode.Game)
      }
      title={isRunning ? "Stop" : "Run"}
      className={cn(
        "flex items-center gap-1.5 py-1.5 px-3 text-[13px] cursor-pointer border rounded-md font-[var(--vscode-font-family,inherit)]",
        "border-[var(--vscode-button-border,transparent)]",
        isRunning
          ? "bg-[var(--vscode-errorForeground,#f14c4c)] text-[var(--vscode-button-foreground,#fff)]"
          : "bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#fff)]",
        className
      )}
      {...props}
    >
      {isRunning ? (
        <>
          <Square size={14} aria-hidden />
          Stop
        </>
      ) : (
        <>
          <Play size={14} aria-hidden />
          Run
        </>
      )}
    </button>
  );
}
