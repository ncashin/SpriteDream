import { PanelLeftClose } from "lucide-react";
import { useState } from "react";
import { Assets } from "./Assets";
import { IconButton } from "./IconButton";
import { SceneView } from "./SceneView";
import { cn } from "../utils/cn";

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "h-full max-h-screen flex flex-col bg-[#2c2c2c] border-r border-[#444444] transition-[width] duration-200 ease-out",
        collapsed ? "w-14 min-w-14 shrink-0" : "min-w-80 w-80 max-w-80"
      )}
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
        {!collapsed && (
          <>
            <span className="text-sm font-medium text-dark-tx truncate flex-1">
              GameIDE
            </span>
            <IconButton
              icon={PanelLeftClose}
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="sidebar-hover ml-auto"
            />
          </>
        )}
      </header>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-0.5">
          <SceneView />
          <Assets />
        </div>
      )}
    </div>
  );
};
