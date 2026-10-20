import { css, Frame } from "remix/component";
import { Document } from "../document.tsx";
import { routes } from "../../routes.ts";
import { Header } from "./header.tsx";
import { Sidebar } from "./sidebar.tsx";
import { Timeline } from "./timeline/timeline.tsx";

export function Editor() {
  return () => (
    <Document>
      <div mix={shell}>
        <Sidebar />
        <div mix={stage}>
          <Header />
          <div mix={surfaceSlot}>
            <div mix={surface}>
              <Frame src={routes.game.index.href()} />
            </div>
          </div>
          <Timeline />
        </div>
      </div>
    </Document>
  );
}

const shell = css({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "row",
  height: "100vh",
  overflow: "hidden",
  position: "relative",
});

const stage = css({
  boxSizing: "border-box",
  flex: "1 1 0",
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  position: "relative",
  zIndex: 0,
});

const surfaceSlot = css({
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 0",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
});

const surface = css({
  flex: "1 1 0",
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  background: "#1c1c1e",
  overflow: "hidden",
  "& > *": {
    flex: "1 1 0",
    minHeight: 0,
    minWidth: 0,
    border: "none",
  },
});
