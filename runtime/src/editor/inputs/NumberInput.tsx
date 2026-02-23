import { cn } from "../../utils/cn";
import { inputBase } from "./inputBase";
import type { InputDisplayProps } from "./types";

export function NumberInput({ displayValue, onChange }: InputDisplayProps) {
  const isEmpty =
    displayValue === "" ||
    displayValue === undefined ||
    displayValue === null ||
    (typeof displayValue === "number" && Number.isNaN(displayValue));
  const raw = isEmpty ? "" : String(displayValue);
  return (
    <input
      type="text"
      inputMode="decimal"
      className={cn(inputBase, "truncate overflow-ellipsis")}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") {
          onChange?.(Number.NaN);
        } else {
          const n = Number(v);
          if (Number.isFinite(n)) onChange?.(n);
        }
      }}
      readOnly={!onChange}
    />
  );
}
