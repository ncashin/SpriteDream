import { useState, type Ref } from "react";
import { SceneTree } from "./SceneTree.js";
import { GameView } from "./GameView.js";
import { Sidebar } from "./Sidebar.js";
import { cn } from "../utils/cn.js";
import { OverlayButton } from "./OverlayButton.js";
import { OverlayInput } from "./OverlayInput.js";
import { Cuboid, MoveLeft, Play, Square } from "lucide-react";
import { GameIDEMode, setMode } from "../lifecycle/mode.js";
import { useGameIDEMode } from "../hooks/useGameIDEMode.js";
import { getScene } from "../scene/scene.js";
import { getValueAtPath, setValueAtPath } from "../scene/path.js";
import { useScene } from "../hooks/useScene.js";
import { EditorRoot } from "./EditorRoot.js";

export function DefaultEditor({
  gameViewRef,
}: {
  gameViewRef?: Ref<HTMLDivElement>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mode = useGameIDEMode();
  const isRunning = mode === GameIDEMode.Game;
  const [scene] = useScene();
  const sceneName = getValueAtPath(scene as Record<PropertyKey, unknown>, [
    "__metadata",
    "name",
  ]);
  const setSceneName = (next: string) =>
    setValueAtPath(getScene() as Record<PropertyKey, unknown>, [
      "__metadata",
      "name",
    ], next);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <SceneTree />
      </Sidebar>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <GameView ref={gameViewRef} className="h-full" />

        <div className="absolute top-3 flex items-center justify-between px-3 gap-3">
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

          <OverlayInput
            value={
              typeof sceneName === "string" && sceneName.length > 0
                ? sceneName
                : ""
            }
            onChange={(next) => setSceneName(next)}
            placeholder="Untitled Scene"
          />

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
