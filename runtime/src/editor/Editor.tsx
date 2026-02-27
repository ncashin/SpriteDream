import { useEffect, useState } from "react";
import { Cog, PlayIcon, Square } from "lucide-react";

import { GameView } from "./GameView";
import { OverlayButton } from "./OverlayButton";
import { Sidebar } from "./Sidebar";
import { TransformModeWidget } from "./TransformModeWidget";
import { syncIFrameScene } from "../iframe/iframe";

export const Editor = () => {
  const [runKey, setRunKey] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [gameWindow, setGameWindow] = useState<Window | null>(null);
  const [sceneSyncKey, setSceneSyncKey] = useState(0);

  useEffect(() => {
    if (!gameWindow) return;
    return syncIFrameScene({
      targetWindow: gameWindow,
      origin: "*",
      onPatchApplied: () => setSceneSyncKey((k) => k + 1),
    });
  }, [gameWindow]);

  const handleRunStop = () => {
    setRunKey((k) => k + 1);
    setIsRunning((r) => !r);
  };

  return (
    <div className="flex flex-row h-screen w-full min-h-0">
      <Sidebar sceneSyncKey={sceneSyncKey} />
      <div className="relative flex flex-1 min-w-0 min-h-0">
        <GameView
          key={runKey}
          runMode={isRunning}
          onIframeLoad={setGameWindow}
        />
        <div className="absolute top-3.5 right-3.5 z-10 flex flex-row items-center gap-1  rounded-md bg-editor-background p-0.5">
          <TransformModeWidget />
          <OverlayButton text="Settings" icon={Cog} />
          <OverlayButton
            text={isRunning ? "Stop" : "Run"}
            icon={isRunning ? Square : PlayIcon}
            onClick={handleRunStop}
          />
        </div>
      </div>
    </div>
  );
};
