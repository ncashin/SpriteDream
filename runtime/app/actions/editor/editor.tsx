import { css, Frame } from "remix/component";
import { Document } from "../document.tsx";
import { routes } from "../../routes.ts";
import { Sidebar } from "./sidebar.tsx";

export function Editor() {
  return () => (
    <Document>
      <div
        mix={[
          css({
            display: "flex",
            flexDirection: "row",
            height: "100vh",
            overflow: "hidden",
            position: "relative",
          }),
        ]}
      >
        <Sidebar />
        <div
          mix={[
            css({
              flex: "1 1 0",
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              zIndex: 0,
            }),
          ]}
        >
          <Frame src={routes.game.index.href()} />
        </div>
      </div>
    </Document>
  );
}
