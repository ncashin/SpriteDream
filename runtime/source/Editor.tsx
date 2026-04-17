import { useState } from "react";
import {
  SceneTree,
  GameView,
  Sidebar,
  OverlayButton,
  OverlayInput,
  GameIDEMode,
  setMode,
  useGameIDEMode,
  useScene,
  EditorRoot,
  getScene,
  getValueAtPath,
  setValueAtPath,
} from "gameide";
import { Cuboid, MoveLeft, Play, Square } from "lucide-react";

export function Editor() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mode = useGameIDEMode();
  const isRunning = mode === GameIDEMode.Game;
  const [scene] = useScene();
  const sceneName = getValueAtPath(scene, [
    "__metadata",
    "name",
  ]);
  const setSceneName = (next: string) =>
    setValueAtPath(getScene(), ["__metadata", "name"], next);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <SceneTree />
      </Sidebar>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <GameView className="h-full" />

        <div className="absolute top-3 w-full flex items-center justify-between px-3 gap-3">
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

