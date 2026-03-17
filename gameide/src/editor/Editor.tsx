import { useState } from "react";
import { SceneTree } from "./SceneTree.js";
import { RunButton } from "./RunButton.js";
import { SidebarToggleButton } from "./SidebarToggleButton.js";
import { GameView } from "./GameView.js";
import { cn } from "../utils/cn.js";

export function Editor() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="pointer-events-auto fixed inset-0">
        <div
          className={cn(
            "fixed left-0 top-0 bottom-0 w-[17.5rem] max-w-[85vw] bg-[var(--vscode-editor-background)] border-r border-[var(--vscode-panel-border)] overflow-auto z-[2147483646] transition-transform duration-200 ease-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SceneTree />
        </div>

        <div
          className={cn(
            "relative h-full ml-0 transition-[margin-left] duration-200 ease-out",
            sidebarOpen && "ml-[17.5rem]",
          )}
        >
          <GameView />

          <div className="absolute top-3 left-3 z-[2147483647]">
            <SidebarToggleButton
              open={sidebarOpen}
              onToggle={() => setSidebarOpen((o) => !o)}
            />
          </div>

          <div className="absolute top-3 right-3 z-[2147483647]">
            <RunButton />
          </div>
        </div>
      </div>
    </div>
  );
}
