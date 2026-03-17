import { useState } from "react";
import { SceneTree } from "./SceneTree.js";
import { GameView } from "./GameView.js";
import { Sidebar } from "./Sidebar.js";
import { cn } from "../utils/cn.js";
import { OverlayButton } from "./OverlayButton.js";
import { OverlayInput } from "./OverlayInput.js";
import { Cuboid, MoveLeft, Play, Square } from "lucide-react";
import { GameIDEMode, setMode } from "../mode.js";
import { useGameIDEMode } from "./useGameIDEMode.js";
import { useScene } from "./useScene.js";
import { EditorRoot } from "./EditorRoot.js";

export function Editor() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mode = useGameIDEMode();
  const isRunning = mode === GameIDEMode.Game;
  const [sceneName, setSceneName] = useScene(["name"]);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <SceneTree />
      </Sidebar>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <GameView className="h-full" />

        <div className="absolute top-3 inset-x-0 flex justify-between px-3 items-center gap-3">
          <OverlayButton
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? "Close scene" : "Open scene"}
          >
            {sidebarOpen ? (
              <>
                <MoveLeft size={12} aria-hidden />
                Scene View
              </>
            ) : (
              <>
                <Cuboid size={12} aria-hidden />
                Scene View
              </>
            )}
          </OverlayButton>

          <div className="flex-1 flex justify-center">
            <OverlayInput
              value={
                typeof sceneName === "string" && sceneName.length > 0
                  ? sceneName
                  : ""
              }
              onChange={(next) => setSceneName(next)}
              placeholder="Untitled Scene"
            />
          </div>

          <OverlayButton
            variant={isRunning ? "danger" : "default"}
            onClick={() =>
              setMode(isRunning ? GameIDEMode.Editor : GameIDEMode.Game)
            }
            title={isRunning ? "Stop" : "Run"}
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
        </div>
      </div>
    </EditorRoot>
  );
}
