import { PanelLeftClose } from "lucide-react";
import { useEffect, useState } from "react";
import { Assets } from "./Assets";
import { IconButton } from "./IconButton";
import { SceneView } from "./SceneView";
import { cn } from "../utils/cn";

const FADE_MS = 150;

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  const showContent = !collapsed || fadingOut;

  // Fade in when expanding
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

  const handleCollapse = () => {
    setFadingOut(true);
    setCollapsed(true); /* start width resize immediately, in parallel with fade */
    setTimeout(() => setFadingOut(false), FADE_MS);
  };

  return (
    <div
      className="sidebar-clip h-full max-h-screen flex flex-col bg-[#2c2c2c] border-r border-[#444444] shrink-0 overflow-hidden"
      style={{ width: collapsed ? "3.5rem" : "20rem" }}
    >
      <div className="sidebar-inner h-full flex flex-col shrink-0">
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
        {showContent && (
          <div
            className={cn(
              "sidebar-content-fade flex flex-1 items-center gap-2 min-w-0 pointer-events-none",
              contentVisible && !fadingOut && "sidebar-content-visible pointer-events-auto"
            )}
          >
            <span className="text-sm font-medium text-dark-tx truncate flex-1">
              GameIDE
            </span>
            <IconButton
              icon={PanelLeftClose}
              onClick={handleCollapse}
              title="Collapse sidebar"
              className="sidebar-hover ml-auto"
            />
          </div>
        )}
      </header>
      {showContent && (
        <div
          className={cn(
            "sidebar-content-fade flex-1 min-h-0 overflow-hidden flex flex-col gap-0.5 pointer-events-none",
            contentVisible && !fadingOut && "sidebar-content-visible pointer-events-auto"
          )}
        >
          <SceneView />
          <Assets />
        </div>
      )}
      </div>
    </div>
  );
};
