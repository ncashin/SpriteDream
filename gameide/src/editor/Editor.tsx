import { PanelLeftClose } from "lucide-react";
import { useState } from "react";
import { SceneTree } from "./SceneTree.js";
import { RunButton } from "./RunButton.js";
import { SidebarToggleButton } from "./SidebarToggleButton.js";
import { cn } from "../utils/cn.js";

export function Editor() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="pointer-events-auto fixed inset-0">
        <div
          className={cn(
            "fixed left-0 top-0 bottom-0 w-[17.5rem] max-w-[85vw] bg-[var(--vscode-editor-background)] border-r border-[var(--vscode-panel-border)] overflow-auto transition-transform duration-200 ease-out z-[2147483646]",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SceneTree />
        </div>

        {/* Same left offset (0.75rem) from viewport or from sidebar right edge */}
        <div
          className={cn(
            "fixed top-3 z-[2147483647] transition-[left] duration-200 ease-out",
            sidebarOpen ? "left-[calc(17.5rem+0.75rem)]" : "left-3"
          )}
        >
          <SidebarToggleButton
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
          />
        </div>

        <div className="fixed top-3 right-3 z-[2147483647]">
          <RunButton />
        </div>
      </div>
    </div>
  );
}
