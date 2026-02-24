import { useState } from "react";
import { cn } from "../../utils/cn";
import { inputBase } from "./inputBase";
import type { InputDisplayProps } from "./types";

function isEmpty(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    (typeof v === "number" && Number.isNaN(v))
  );
}

export function NumberInput({ displayValue, onChange }: InputDisplayProps) {
  const propRaw = isEmpty(displayValue) ? "" : String(displayValue);
  const [focused, setFocused] = useState(false);
  const [local, setLocal] = useState(propRaw);

  const value = focused ? local : propRaw;

  return (
    <input
      type="text"
      inputMode="decimal"
      className={cn(inputBase, "truncate overflow-ellipsis")}
      value={value}
      onFocus={() => {
        setLocal(propRaw);
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        const n = Number(local);
        if (local !== "" && Number.isFinite(n)) {
          setLocal(String(n));
        }
      }}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (v === "") {
          onChange?.(Number.NaN);
        } else {
          const n = Number(v);
          if (Number.isFinite(n)) {
            onChange?.(n);
          }
        }
      }}
      readOnly={!onChange}
    />
  );
}
