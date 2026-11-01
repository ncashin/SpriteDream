import { css } from "remix/component";
import type { Handle } from "remix/component";

import type { SceneNode } from "../../../utilities/scene.ts";
import { HierarchyTree } from "./tree/hierarchy-tree.tsx";
import { SelectedObjectTree } from "./selected-object-tree.tsx";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_MOTION = "200ms cubic-bezier(0.4, 0, 0.2, 1)";

export function SceneSidebar(handle: Handle<{ scene: SceneNode }>) {
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
      <aside
        inert={collapsed}
        mix={sceneSidebar}
        style={{ width: collapsed ? "0rem" : SIDEBAR_WIDTH }}
      >
        <HierarchyTree object={handle.props.scene} />
        <SelectedObjectTree collapsed={collapsed} scene={handle.props.scene} />
      </aside>
    );
}

const sceneSidebar = css({
  boxSizing: "border-box",
  display: "flex",
  flex: "0 0 auto",
  flexDirection: "column",
  alignItems: "flex-start",
  fontSize: "13px",
  height: "100%",
  lineHeight: 1.35,
  minHeight: 0,
  overflow: "hidden",
  position: "relative",
  transition: `width ${SIDEBAR_MOTION}`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
  "& > *": {
    width: SIDEBAR_WIDTH,
    flexShrink: 0,
  },
  "& > #scene-tree": {
    boxSizing: "border-box",
    flex: "1 1 33.333%",
    minHeight: 0,
    minWidth: 0,
    overflow: "auto",
    padding: "calc(0.4rem + 0.45em - 1.5px) 0 1rem",
    background: "#121213",
    "--tree-sticky": "#121213",
  },
});
