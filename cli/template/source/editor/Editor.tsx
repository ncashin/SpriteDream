import { useState, type Ref } from "react";
import { EditorRoot, GameView } from "gameide";
import { RunButton } from "./components/RunButton";
import { SceneTree } from "./components/SceneTree";
import { Sidebar } from "./components/Sidebar";
import { SidebarToggleButton } from "./components/SidebarToggleButton";
import { TransformGizmoBar } from "./components/TransformGizmoBar";

export function Editor({
  gameViewRef,
}: {
  gameViewRef?: Ref<HTMLDivElement>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <EditorRoot>
      <Sidebar open={sidebarOpen}>
        <SceneTree />
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
            <RunButton />
          </div>
        </div>
      </div>
    </EditorRoot>
  );
}
