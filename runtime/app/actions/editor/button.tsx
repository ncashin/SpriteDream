import { css, on, ref } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

type ButtonProps = {
  size?: "small" | "default" | "field";
  muted?: boolean;
  label?: string;
  popup?: "menu";
  expanded?: boolean;
  pressed?: boolean;
  buttonRef?: (node: HTMLButtonElement | null) => void;
  onClick?: (event: MouseEvent) => void;
  children?: RemixNode;
};

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    const { size = "default", muted = false, label, popup, expanded, pressed, buttonRef, onClick, children } = handle.props;
    return (
      <button
        type="button"
        aria-label={label}
        aria-haspopup={popup}
        aria-expanded={expanded}
        aria-pressed={pressed}
        mix={[
          button,
          muted && mutedText,
          size === "small" && small,
          size === "field" && field,
          buttonRef &&
            ref((node) => {
              buttonRef(node instanceof HTMLButtonElement ? node : null);
            }),
          on("click", (event) => {
            onClick?.(event);
          }),
        ]}
      >
        {children}
      </button>
    );
  };
}

const button = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.6em",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  gap: "0.3em",
  marginLeft: "auto",
  padding: "0.3em 0.5em",
  pointerEvents: "auto",
  font: "inherit",
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.35,
  whiteSpace: "nowrap",
  "&:hover": {
    background: "var(--hover)",
  },
  "&:focus-visible": {
    background: "var(--hover)",
    outline: "1px solid var(--line)",
    outlineOffset: "1px",
  },
});

const mutedText = css({
  color: "var(--text-muted)",
  "&:hover, &:focus-visible": {
    color: "var(--text)",
  },
});

const small = css({
  maxHeight: "1.25rem",
  fontSize: "10px",
});

const field = css({
  padding: "0.45em 0.55em",
});
