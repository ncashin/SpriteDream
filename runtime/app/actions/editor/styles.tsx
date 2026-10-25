import { css } from "remix/component";

export const treeRow = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "transparent",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: "var(--hover)",
  },
  "&[aria-current='true']": {
    backgroundColor: "var(--selected)",
  },
  "&[aria-current='true']:hover": {
    backgroundColor: "var(--selected)",
  },
  "& > button, & > div > button": {
    visibility: "hidden",
  },
  "&:hover > button, &:hover > div > button, &:focus-within > button, &:focus-within > div > button, &:has(:popover-open) > button, &:has(:popover-open) > div > button":
    {
      visibility: "visible",
    },
});
