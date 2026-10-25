import { css, on, ref } from "remix/component";
import type { CSSMixinDescriptor, Handle, RemixNode } from "remix/component";

type ButtonProps = {
  size?: "small" | "default" | "field";
  muted?: boolean;
  label?: string;
  popup?: "menu";
  expanded?: boolean;
  pressed?: boolean;
  mix?: CSSMixinDescriptor | CSSMixinDescriptor[];
  buttonRef?: (node: HTMLButtonElement | null) => void;
  onClick?: (event: MouseEvent) => void;
  children?: RemixNode;
};

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    const { size = "default", muted = false, label, popup, expanded, pressed, mix: extra, buttonRef, onClick, children } = handle.props;
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
          ...(Array.isArray(extra) ? extra : [extra]),
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

export const bouncy = css({
  transformOrigin: "center",
  transition: "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
  "&:hover": {
    transform: "scale(1.008)",
  },
  "&:active": {
    transform: "scale(0.992)",
    transitionDuration: "60ms",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "&:hover, &:active": {
      transform: "none",
    },
  },
});
