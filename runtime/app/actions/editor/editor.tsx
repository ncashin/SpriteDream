import Eye from "lucide/dist/esm/icons/eye.mjs";
import EyeOff from "lucide/dist/esm/icons/eye-off.mjs";
import { clientEntry, css, Frame, on } from "remix/component";
import type { Handle } from "remix/component";
import { routes } from "../../routes.ts";
import { Icon } from "../../icon.tsx";
import { bouncy } from "./button.tsx";
import { isEditorHidden, onEditorHidden, setEditorHidden } from "./chrome.ts";
import { Header } from "./header.tsx";
import { Sidebar } from "./sidebar.tsx";

export const Editor = clientEntry(import.meta.url, function Editor(handle: Handle) {
  onEditorHidden(() => handle.update(), handle.signal);

  return () => {
    return (
    <div mix={shell}>
      <Sidebar />
      <div mix={stage}>
        <Header />
        <div mix={surfaceSlot}>
          <div mix={surface}>
            <Frame src={routes.game.index.href()} />
          </div>
        </div>
        <button
          type="button"
          aria-pressed={isEditorHidden()}
          aria-label="Hide Overlay UI"
          mix={[
            hideUi,
            bouncy,
            on("click", () => {
              setEditorHidden(!isEditorHidden());
            }),
          ]}
        >
          Hide Overlay UI
          <Icon icon={isEditorHidden() ? EyeOff : Eye} size={12} />
        </button>
      </div>
    </div>
    );
  };
});

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

const hideUi = css({
  appearance: "none",
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: "6px",
  bottom: "0.8rem",
  boxSizing: "border-box",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  fontSize: "13px",
  fontWeight: 450,
  gap: "0.35em",
  justifyContent: "center",
  lineHeight: 1.35,
  padding: "0.25em 0.7em 0.25em 0.65em",
  pointerEvents: "auto",
  position: "absolute",
  right: "1rem",
  whiteSpace: "nowrap",
  zIndex: 4,
  "&:hover, &:focus-visible": {
    background: "var(--hover)",
  },
  "&:focus-visible": {
    outline: "1px solid var(--line)",
    outlineOffset: "1px",
  },
});

const surface = css({
  flex: "1 1 0",
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  background: "#393939",
  overflow: "hidden",
  "& > *": {
    flex: "1 1 0",
    minHeight: 0,
    minWidth: 0,
    border: "none",
  },
});
