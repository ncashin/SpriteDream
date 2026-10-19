import { clientEntry, css } from "remix/component";
import type { Handle } from "remix/component";

import { scene } from "../../utilities/scene.ts";
import { isCollapsed, onCollapsedChange, SIDEBAR_MOTION, SIDEBAR_WIDTH } from "./collapsed.ts";
import { HierarchyTree } from "./hierarchy-tree.tsx";
import { ObjectSidebar } from "./object-sidebar.tsx";

function releaseInitialCollapse() {
  const release = () => {
    const panels = document.querySelectorAll<HTMLElement>("[data-sidebar]");
    const ready = panels.length >= 1 && [...panels].every((panel) => panel.style.width === "0rem");
    if (!ready) {
      requestAnimationFrame(release);
      return;
    }
    delete document.documentElement.dataset.sidebarCollapsed;
  };
  requestAnimationFrame(release);
}

export const Sidebar = clientEntry(import.meta.url, function Sidebar(handle: Handle) {
  let collapsed = isCollapsed();
  if (collapsed) releaseInitialCollapse();
  onCollapsedChange(() => {
    collapsed = isCollapsed();
    handle.update();
  }, handle.signal);

  return () => (
    <div data-sidebar="" mix={dock} style={{ width: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
      <aside inert={collapsed} mix={column}>
        <div id="scene-tree" mix={[tree, treeOuterPadding]}>
          <HierarchyTree object={scene} />
        </div>
      </aside>
      <ObjectSidebar collapsed={collapsed} />
    </div>
  );
});

const dock = css({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "0 0 auto",
  fontSize: "13px",
  lineHeight: 1.35,
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  borderRight: "1px solid var(--line)",
  transition: `width ${SIDEBAR_MOTION}`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const column = css({
  boxSizing: "border-box",
  borderBottom: "1px solid var(--line)",
  display: "flex",
  flex: "1 1 33.333%",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
});

const treeOuterPadding = css({
  padding: "calc(0.5rem + 0.45em) 0.75rem 1rem",
});

const tree = css({
  boxSizing: "border-box",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "auto",
});
