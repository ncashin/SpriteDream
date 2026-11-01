import { css, on } from "remix/component";
import type { Handle } from "remix/component";

type ColorInputProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
};

const borderRadius = "6px";

const colorPicker = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius,
  boxSizing: "border-box",
  cursor: "pointer",
  flex: "0 0 auto",
  height: "1.25rem",
  margin: 0,
  marginLeft: "auto",
  padding: "calc((1.25rem - 14px) / 2)",
  width: "1.25rem",
  "&::-webkit-color-swatch-wrapper": {
    padding: 0,
  },
  "&::-webkit-color-swatch": {
    border: "1px solid var(--line)",
    borderRadius: 0,
  },
  "&::-moz-color-swatch": {
    border: "1px solid var(--line)",
    borderRadius: 0,
  },
  "&:hover": {
    background: "var(--hover)",
  },
  "&:focus-visible": {
    background: "var(--hover)",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});

export function parseHexColor(value: string): { rgb: string; alpha: string } | null {
  let match = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length <= 4) hex = [...hex].map((digit) => digit + digit).join("");
  return {
    rgb: `#${hex.slice(0, 6).toLowerCase()}`,
    alpha: hex.length === 8 ? hex.slice(6).toLowerCase() : "",
  };
}

export function ColorInput(handle: Handle<ColorInputProps>) {
  return () => {
    const color = parseHexColor(handle.props.value);
    if (!color) return null;
    return (
      <input
        type="color"
        aria-label={handle.props.label}
        value={color.rgb}
        mix={[
          colorPicker,
          on("pointerdown", (event) => {
            event.stopPropagation();
          }),
          on("input", (event) => {
            const rgb = event.currentTarget.value;
            handle.props.onChange(color.alpha ? `${rgb}${color.alpha}` : rgb);
          }),
        ]}
      />
    );
  };
}
