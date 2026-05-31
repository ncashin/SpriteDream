export type EditorColorName = "red" | "blue" | "green" | "highlight";

const CSS_VARS: Record<EditorColorName, string> = {
  red: "--color-red",
  blue: "--color-blue",
  green: "--color-green",
  highlight: "--color-highlight",
};

const FALLBACK: Record<EditorColorName, number> = {
  red: 0xff5252,
  blue: 0x4da3ff,
  green: 0x39d353,
  highlight: 0x7ec8ff,
};

export function editorColor(name: EditorColorName): number {
  if (typeof document === "undefined") return FALLBACK[name];
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(CSS_VARS[name])
    .trim();
  const hex = raw.replace(/^#/, "");
  const parsed = Number.parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : FALLBACK[name];
}
