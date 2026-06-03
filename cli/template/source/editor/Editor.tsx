import { Save } from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import { EditorRoot, GameView, useSceneFile } from "gameide";
import { OverlayButton } from "./components/OverlayButton";
import { RunButton } from "./components/RunButton";
import { SceneTree } from "./components/SceneTree";
import { SearchDropdown } from "./components/SearchDropdown";
import { Sidebar } from "./components/Sidebar";
import { SidebarToggleButton } from "./components/SidebarToggleButton";
import { TransformGizmoBar } from "./components/TransformGizmoBar";
import SceneTreeTest from "./components/SceneTreeTest";

function SceneFileSelector() {
  const { scenes, activeScenePath, switchScene } = useSceneFile();

  return (
    <SearchDropdown
      variant="header"
      value={activeScenePath}
      options={scenes.map((file) => ({ value: file, label: file }))}
      onSelect={(file) => void switchScene(file)}
      searchPlaceholder="Search scenes…"
      emptyMessage="No scenes found"
      ariaLabel="Active scene file"
      className="w-full min-w-0"
    />
  );
}

export function Editor({
  gameViewRef,
}: {
  gameViewRef?: Ref<HTMLDivElement>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { save, dirty, saving } = useSceneFile();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "s" && event.key !== "S") return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      event.preventDefault();
      save();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <div className="flex flex-col w-full h-full bg-[var(--color-bg)]">
          <header className="sticky w-full shrink-0 bg-[var(--color-bg)]">
            <SceneFileSelector />
          </header>
          <div className="flex flex-1 flex-col min-w-0 min-h-0">
            <SceneTreeTest />
          </div>
        </div>
   
      </Sidebar>

      <div className="relative flex-1 min-w-0 overflow-hidden">
        <GameView ref={gameViewRef} className="h-full" />

        <div className="absolute top-3 left-0 right-0 flex h-[22px] min-h-[22px] items-center px-3 gap-3 box-border">
          <SidebarToggleButton
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
          />

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <TransformGizmoBar />
            <OverlayButton
              onClick={() => save()}
              disabled={!dirty || saving}
            >
              <Save size={12} aria-hidden />
              Save
            </OverlayButton>
            <RunButton />
          </div>
        </div>
      </div>
    </EditorRoot>
  );
}
