import { clientEntry, css } from "remix/component";
import type { Handle } from "remix/component";

import { scene } from "../../../utilities/scene.ts";
import { HierarchyTree } from "./tree/hierarchy-tree.tsx";
import { ObjectSidebar } from "./object-sidebar.tsx";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_MOTION = "200ms cubic-bezier(0.4, 0, 0.2, 1)";

export const Sidebar = clientEntry(import.meta.url, function Sidebar(handle: Handle) {
  let collapsed = false;
  if (typeof window !== "undefined") {
    window.addEventListener(
      "toggle-sidebars",
      () => {
        collapsed = !collapsed;
        handle.update();
      },
      { signal: handle.signal },
    );
  }

  return () => (
    <div mix={dock} style={{ width: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
      <div mix={clip}>
        <aside inert={collapsed} mix={column}>
          <div id="scene-tree" mix={[tree, treeOuterPadding]}>
            <HierarchyTree object={scene} />
          </div>
        </aside>
        <ObjectSidebar collapsed={collapsed} />
      </div>
    </div>
  );
});

const dock = css({
  boxSizing: "border-box",
  flex: "0 0 auto",
  fontSize: "13px",
  height: "100%",
  lineHeight: 1.35,
  minHeight: 0,
  position: "relative",
  transition: `width ${SIDEBAR_MOTION}`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const clip = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  "& > *": {
    width: SIDEBAR_WIDTH,
    flexShrink: 0,
  },
});

const column = css({
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 33.333%",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
});

const treeOuterPadding = css({
  padding: "calc(0.4rem + 0.45em - 1.5px) 0 1rem",
});

const tree = css({
  boxSizing: "border-box",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "auto",
  "--tree-sticky": "#121213",
});
