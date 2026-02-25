import { PanelLeftClose } from "lucide-react";
import { useEffect, useState } from "react";
import { Assets } from "./Assets";
import { IconButton } from "./IconButton";
import { SceneView } from "./SceneView";
import { cn } from "../utils/cn";

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  // Fade in when expanding (opacity 0 -> 1 after mount)
  useEffect(() => {
    if (!collapsed) {
      setContentVisible(false);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setContentVisible(true));
      });
      return () => cancelAnimationFrame(t);
    }
    setContentVisible(false);
  }, [collapsed]);

  const contentHidden = collapsed || !contentVisible;

  return (
    <div
      className="h-full max-h-screen flex flex-col bg-[#2c2c2c] border-r border-[#444444] overflow-hidden"
    >
      <header
        className={cn(
          "pl-4 pr-4 pt-4 pb-3.5 shrink-0 flex flex-row items-center min-h-[2.75rem]",
          collapsed ? "cursor-pointer" : "gap-2 border-b border-[#444444]"
        )}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
        title={collapsed ? "Expand sidebar" : undefined}
      >
        <span
          className={cn(
            "inline-flex",
            collapsed && "rounded-md sidebar-hover p-2 -m-2"
          )}
        >
          <img
            src="/logo.png"
            alt="Logo"
            className="h-6 w-6 shrink-0 object-contain"
          />
        </span>
        <div
          className={cn(
            "sidebar-content-fade flex flex-1 items-center gap-2 min-w-0",
            contentHidden && "sidebar-content-hidden"
          )}
        >
          <span className="text-sm font-medium text-dark-tx truncate flex-1">
            GameIDE
          </span>
          <IconButton
            icon={PanelLeftClose}
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="sidebar-hover ml-auto"
          />
        </div>
      </header>
      <div
        className={cn(
          "sidebar-content-fade flex-1 min-h-0 overflow-hidden flex flex-col gap-0.5",
          contentHidden && "sidebar-content-hidden"
        )}
      >
        <SceneView />
        <Assets />
      </div>
    </div>
  );
};
