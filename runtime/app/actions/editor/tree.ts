import { css } from "remix/component";

const borderRadius = "6px";

export const row = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  width: "100%",
  boxSizing: "border-box",
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
  borderRadius,
  cursor: "pointer",
  "&:hover": {
    background: "var(--hover)",
  },
  "&[aria-current='true']": {
    background: "var(--selected)",
  },
  "&[aria-current='true']:hover": {
    background: "var(--selected)",
  },
  "& > button": {
    visibility: "hidden",
  },
  "&:hover > button, &:focus-within > button, &:has(:popover-open) > button": {
    visibility: "visible",
  },
});

export const label = css({
  flex: "1 1 auto",
  minWidth: 0,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
});

export const expandable = css({
  "& span > :last-child": {
    visibility: "hidden",
  },
  "&:hover span > :first-child": {
    visibility: "hidden",
  },
  "&:hover span > :last-child": {
    visibility: "visible",
  },
});

export const iconStack = css({
  display: "grid",
  "& > *": { gridArea: "1 / 1" },
});

export const indent = css({ paddingLeft: "0.75rem" });

export const chevronOpen = css({
  "& > :last-child": {
    transform: "rotate(90deg)",
  },
});

export const iconMotion = css({
  "& svg": {
    transition: "transform 180ms ease",
  },
  "@media (prefers-reduced-motion: reduce)": {
    "& svg": { transition: "none" },
  },
});

export const childrenPanel = css({
  display: "grid",
  gridTemplateRows: "0fr",
  transition: "grid-template-rows 180ms ease",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

export const childrenOpen = css({
  gridTemplateRows: "1fr",
});

export const childrenClip = css({
  minHeight: 0,
  overflow: "hidden",
});

export const iconButton = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius,
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  marginLeft: "auto",
  padding: "3px 5px",
  gap: "3px",
  maxHeight: "1.25rem",
  font: "inherit",
  fontSize: "10px",
  fontWeight: 500,
  lineHeight: 1.35,
  "&:hover": {
    background: "var(--hover)",
    color: "var(--text)",
  },
  "&:focus-visible": {
    background: "var(--hover)",
    color: "var(--text)",
    outline: "1px solid var(--line)",
    outlineOffset: "1px",
  },
});
