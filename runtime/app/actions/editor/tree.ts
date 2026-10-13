import { css } from "remix/component";

const borderRadius = "0.25rem";

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
    background: "#1e1e1e",
  },
  "&[aria-current='true']": {
    background: "#262626",
  },
  "&[aria-current='true']:hover": {
    background: "#262626",
  },
  "& > button": {
    visibility: "hidden",
  },
  "&:hover > button": {
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

export const iconButton = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius,
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  marginLeft: "auto",
  padding: 0,
  width: "1.25rem",
  height: "1.25rem",
  font: "inherit",
  lineHeight: 1,
  "&:hover": {
    background: "#333333",
  },
  "&:focus-visible": {
    background: "#333333",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});
