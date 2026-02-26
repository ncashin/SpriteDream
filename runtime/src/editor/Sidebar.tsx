import { useEffect, useState } from "react";
import { Assets } from "./Assets";
import { SceneView } from "./SceneView";
import { SidebarHeaderButton } from "./SidebarHeaderButton";
import { cn } from "../utils/cn";
import { SidebarSimpleIcon } from "@phosphor-icons/react";

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
      className={cn(
        "sidebar-clip h-full max-h-screen flex flex-col border-r border-[#444444] shrink-0 overflow-hidden"
      )}
      style={{
        backgroundColor: "var(--editor-background)",
        width: collapsed ? "3.5rem" : "20rem",
      }}
    >
      <div className="sidebar-inner h-full flex flex-col shrink-0 pt-2">
      <header
        className={cn(
          "sidebar-padding-icon-row shrink-0 flex flex-row items-center",
          collapsed
            ? "!pt-2 !pb-1 !pl-4 !pr-1.5 cursor-pointer min-h-[2.25rem]"
            : "!pt-2 !pb-3 !pl-4 gap-2 min-h-[2.75rem]"
        )}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
        title={collapsed ? "Expand sidebar" : undefined}
      >
        <span
          className={cn(
            "inline-flex",
            collapsed && "rounded-md sidebar-hover sidebar-icon-hit sidebar-icon-hit-inset"
          )}
        >
          <img
            src="/logo.png"
            alt="Logo"
            className="h-7 w-7 shrink-0 object-contain"
          />
        </span>
        {showContent && (
          <div
            className={cn(
              "sidebar-content-fade flex flex-1 items-center gap-2 min-w-0 pointer-events-none justify-end",
              contentVisible && !fadingOut && "sidebar-content-visible pointer-events-auto"
            )}
          >
            <SidebarHeaderButton
              icon={SidebarSimpleIcon}
              size={20}
              onClick={handleCollapse}
              title="Collapse sidebar"
              className="sidebar-hover sidebar-icon-hit w-9 h-9 min-w-9 min-h-9"
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
