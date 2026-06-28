import { Cuboid, Eye, EyeOff, MoveLeft, Save } from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import {
  EditorRoot,
  GameIDEMode,
  GameView,
  deselectObject,
  getMode,
  onModeChange,
  useEditorDebugUI,
  useGameIDEMode,
  useSceneObject,
  useSceneFile,
  useSceneHistory,
  useSelectedSceneObject,
} from "gameide";
import { OverlayButton } from "./components/OverlayButton";
import { RunButton } from "./components/RunButton";
import { SceneFileHeader } from "./components/SceneFileHeader";
import { Sidebar } from "./components/Sidebar";
import { TransformGizmoBar } from "./components/TransformGizmoBar";
import { SceneTree } from "./components/SceneTree";

export function Editor({
  gameViewRef,
}: {
  gameViewRef?: Ref<HTMLDivElement>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { selectedPath } = useSelectedSceneObject();
  const { deleteValue } = useSceneObject(selectedPath ?? []);
  const { save, dirty, saving } = useSceneFile();
  const { undo, redo } = useSceneHistory();
  const mode = useGameIDEMode();
  const canSave = mode === GameIDEMode.Editor && dirty && !saving;
  const { enabled: debugUIEnabled, toggle: toggleDebugUI } = useEditorDebugUI();

  useEffect(() => {
    return onModeChange(() => {
      deselectObject();
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (
        !isEditableTarget &&
        getMode() === GameIDEMode.Editor &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedPath
      ) {
        event.preventDefault();
        deleteValue();
        deselectObject();
        return;
      }

      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        save();
        return;
      }

      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
          return;
        }
        undo();
        return;
      }

      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteValue, redo, save, undo, selectedPath]);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <div className="flex flex-col w-full h-full bg-[var(--color-bg)] gap-4 pt-4 ">
          <SceneFileHeader className="px-2" />
          <SceneTree className="pl-2 pr-4" />
        </div>
      </Sidebar>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <GameView ref={gameViewRef} className="h-full" />

        <div className="absolute top-3 left-0 right-0 flex h-[22px] min-h-[22px] items-center px-3 gap-3 box-border">
          <div className="flex w-24 shrink-0 items-center">
            <OverlayButton
              className="w-full justify-center"
              onClick={() => setSidebarOpen((isOpen) => !isOpen)}
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
          </div>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <div className="flex w-14 shrink-0 items-center">
              <TransformGizmoBar />
            </div>
            <OverlayButton
              className="w-24 justify-center"
              title={debugUIEnabled ? "Hide debug overlays" : "Show debug overlays"}
              aria-pressed={debugUIEnabled}
              aria-label="Debug UI"
              onClick={() => toggleDebugUI()}
            >
              {debugUIEnabled ? (
                <>
                  <Eye size={12} aria-hidden />
                  Debug UI
                </>
              ) : (
                <>
                  <EyeOff size={12} aria-hidden />
                  Debug UI
                </>
              )}
            </OverlayButton>
            <div className="flex w-14 shrink-0 items-center">
              <OverlayButton
                className="w-full justify-center"
                onClick={() => save()}
                disabled={!canSave}
              >
                <Save size={12} aria-hidden />
                Save
              </OverlayButton>
            </div>
            <div className="flex w-14 shrink-0 items-center">
              <RunButton className="w-full justify-center" />
            </div>
          </div>
        </div>
      </div>
    </EditorRoot>
  );
}
