import { css, on, type Handle } from "remix/component";

import { Icon } from "../../../icon.tsx";
import { treeRow } from "../styles.tsx";
import { faceFor } from "./blobs.tsx";

import Circle from "lucide/dist/esm/icons/circle.mjs";
import Park from "lucide/dist/esm/icons/park.mjs";
import X from "lucide/dist/esm/icons/x.mjs";

type FileTabProps = {
  tab: { path: string; dirty: boolean };
  viewers?: string[];
  selected?: boolean;
  onClick: () => void;
  onClose?: () => void;
};

export function FileTab(handle: Handle<FileTabProps>) {
  return () => {
    const { tab, viewers = [], selected = false, onClick: onActivate, onClose } = handle.props;
    const { path, dirty } = tab;

    return (
      <div
        role="tab"
        tabIndex={0}
        aria-selected={selected}
        data-dirty={dirty ? "" : undefined}
        data-remote={onClose ? undefined : ""}
        mix={[
          treeRow,
          tabStyle,
          on("click", () => {
            onActivate();
          }),
          on("keydown", (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onActivate();
          }),
        ]}
      >
        {viewers.length > 0 && (
          <span mix={tabFaces}>
            {viewers.map((id) => (
              <span key={id}>{faceFor(id)}</span>
            ))}
          </span>
        )}
        <Icon icon={Park} />
        {path}
        {onClose ? (
          <button
            type="button"
            aria-label={`Close ${path}`}
            mix={[
              tabClose,
              on("click", (event) => {
                event.stopPropagation();
                onClose();
              }),
            ]}
          >
            <span>
              <Icon icon={X} />
            </span>
            {dirty && (
              <span>
                <Icon icon={Circle} />
              </span>
            )}
          </button>
        ) : (
          dirty && (
            <span aria-hidden="true" mix={remoteDirty}>
              <Icon icon={Circle} />
            </span>
          )
        )}
      </div>
    );
  };
}

const tabStyle = css({
  width: "auto",
  flex: "0 0 auto",
  minHeight: "min-content",
  paddingRight: "1.75rem",
  position: "relative",
  "&[aria-selected='true']": {
    backgroundColor: "var(--selected)",
  },
  "&[aria-selected='true']:hover": {
    backgroundColor: "var(--selected)",
  },
  "&[data-remote]": {
    color: "var(--text-muted)",
  },
  "&[data-dirty] > button": {
    visibility: "visible",
  },
});

const tabFaces = css({
  display: "inline-flex",
  alignItems: "center",
  height: "1.25rem",
  marginBlock: "-0.25rem",
  gap: "0.1rem",
  "& svg": {
    height: "1rem",
    width: "1rem",
  },
});

const remoteDirty = css({
  position: "absolute",
  top: "0.25rem",
  right: "0.25rem",
  bottom: "0.25rem",
  display: "inline-flex",
  alignItems: "center",
  "& svg": {
    fill: "currentColor",
    stroke: "none",
    transform: "scale(0.45)",
  },
});

const tabClose = css({
  position: "absolute",
  top: "0.25rem",
  right: "0.25rem",
  bottom: "0.25rem",
  display: "inline-grid",
  placeItems: "center",
  width: "1.25rem",
  padding: 0,
  border: "none",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  lineHeight: 0,
  cursor: "pointer",
  "& > span": {
    gridArea: "1 / 1",
    display: "none",
  },
  "& > span:first-child": {
    display: "inline-flex",
  },
  "[data-dirty] > & > span:first-child": {
    display: "none",
  },
  "[data-dirty] > & > span:last-child": {
    display: "inline-flex",
  },
  "[data-dirty]:hover > & > span:first-child, [data-dirty]:focus-within > & > span:first-child":
    {
      display: "inline-flex",
    },
  "[data-dirty]:hover > & > span:last-child, [data-dirty]:focus-within > & > span:last-child":
    {
      display: "none",
    },
  "[data-dirty] > & > span:last-child svg": {
    fill: "currentColor",
    stroke: "none",
    transform: "scale(0.45)",
  },
  "&:hover": {
    backgroundColor: "var(--hover)",
  },
});
