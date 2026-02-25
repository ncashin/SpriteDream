import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useState } from "react";
import { cn } from "../utils/cn";
import { IconButton } from "./IconButton";
import { SceneView } from "./SceneView";

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`h-full flex flex-col bg-[#2c2c2c] border border-dark-ui transition-[width] duration-200 ease-out ${
        collapsed ? "min-w-12 w-12 max-w-12" : "min-w-80 w-80 max-w-80"
      }`}
    >
      <header
        className={`shrink-0 border-b border-dark-ui flex min-h-[2.75rem] sidebar-padding ${
          collapsed
            ? "flex-col items-center gap-1"
            : "flex-row items-center gap-2"
        }`}
      >
        <img
          src="/logo.png"
          alt="Logo"
          className="h-6 w-6 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="text-sm font-medium text-dark-tx truncate flex-1">
            Scene
          </span>
        )}
        <IconButton
          icon={collapsed ? PanelLeft : PanelLeftClose}
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("sidebar-hover", collapsed ? "" : "ml-auto")}
        />
      </header>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-auto sidebar-padding">
          <SceneView />
        </div>
      )}
    </div>
  );
};
