import { cn } from "../../utils/cn";
import { inputBase } from "./inputBase";
import type { InputDisplayProps } from "./types";

export function StringInput({ displayValue, onChange }: InputDisplayProps) {
  return (
    <input
      type="text"
      className={cn(inputBase, "truncate overflow-ellipsis")}
      value={displayValue as string}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={!onChange}
    />
  );
}
