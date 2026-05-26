import { useState, type Ref } from "react";
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
  TransformGizmoBar,
  getScene,
  getValueAtPath,
  setValueAtPath,
} from "gameide";
import { Cuboid, MoveLeft, Play, Square } from "lucide-react";

export function Editor({
  gameViewRef,
}: {
  gameViewRef?: Ref<HTMLDivElement>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mode = useGameIDEMode();
  const isRunning = mode === GameIDEMode.Game;
  const [scene] = useScene();
  const sceneName = getValueAtPath(scene, [
    "__metadata",
    "name",
  ]);
  const setSceneName = (next: string) =>
    setValueAtPath(getScene().get(), ["__metadata", "name"], next);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <SceneTree />
      </Sidebar>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <GameView ref={gameViewRef} className="h-full" />

        <div className="absolute top-3 left-0 right-0 flex h-[22px] min-h-[22px] items-center px-3 gap-3 box-border">
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
            className="min-w-[10rem] flex-1 basis-0"
            value={
              typeof sceneName === "string" && sceneName.length > 0
                ? sceneName
                : ""
            }
            onChange={(next) => setSceneName(next)}
            placeholder="Untitled Scene"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            <TransformGizmoBar />
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
      </div>
    </EditorRoot>
  );
}
