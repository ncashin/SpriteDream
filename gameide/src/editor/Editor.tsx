import { PanelLeftClose } from "lucide-react";
import { useState } from "react";
import { SceneTree } from "./SceneTree.js";
import { RunButton } from "./RunButton.js";
import { SidebarToggleButton } from "./SidebarToggleButton.js";

export function Editor() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="fixed inset-0 z-[2147483647] pointer-events-none">
      <div className="pointer-events-auto fixed inset-0">
        <div
          className={`fixed left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-[var(--vscode-editor-background,#1e1e1e)] border-r border-[var(--vscode-panel-border,rgba(255,255,255,0.1))] shadow-[2px_0_12px_rgba(0,0,0,0.3)] overflow-auto transition-transform duration-200 ease-out z-[2147483646] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between py-2.5 px-3 border-b border-[var(--vscode-panel-border,rgba(255,255,255,0.1))] min-h-10">
            <span className="text-[11px] font-semibold text-[var(--vscode-descriptionForeground,#8b949e)] uppercase tracking-wide">
              Scene
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Close"
              className="flex items-center justify-center w-7 h-7 border-0 rounded cursor-pointer bg-transparent text-[var(--vscode-editor-foreground,#ccc)]"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          <SceneTree />
        </div>

        <div className="fixed top-3 left-3 z-[2147483647]">
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
