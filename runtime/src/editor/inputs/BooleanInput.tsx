import type { InputDisplayProps } from "./types";

export type BooleanInputProps = InputDisplayProps & { label?: string };

export function BooleanInput({ displayValue, onChange, label }: BooleanInputProps) {
  const checkbox = (
    <input
      type="checkbox"
      className="accent-dark-ui text-dark-tx-2"
      checked={!!displayValue}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={!onChange}
    />
  );

  if (label != null) {
    return (
      <label className="flex flex-row items-center w-full group gap-2 sidebar-padding font-semibold text-dark-tx cursor-pointer sidebar-hover rounded-md min-h-[1.5rem]">
        <h2>{label}</h2>
        <div className="flex-1 min-w-0 flex items-center p-0.5 px-1">{checkbox}</div>
      </label>
    );
  }

  return (
    <label className="flex items-center gap-2 min-h-[1.5rem] p-0.5 px-1 rounded-md sidebar-hover focus-within:bg-dark-ui cursor-pointer">
      {checkbox}
    </label>
  );
}
