import { useEffect, useRef, useState } from "react";
import type React from "react";
import { cn } from "../utils/cn";

const inputBase =
  "min-w-0 flex-1 bg-transparent text-dark-tx-2 cursor-pointer focus:outline-none focus:text-light-ui focus:bg-dark-ui hover:bg-dark-ui p-0.5 px-1 rounded-md transition-colors";

const displayComponents: Record<
  string,
  (props: {
    value: unknown;
    onChange?: (val: unknown) => void;
    displayValue: unknown;
  }) => React.ReactNode
> = {
  string: ({ displayValue, onChange }) => (
    <input
      type="text"
      className={cn(inputBase, "truncate overflow-ellipsis")}
      value={displayValue as string}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={!onChange}
    />
  ),
  number: ({ displayValue, onChange }) => {
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
  },
  boolean: ({ displayValue, onChange }) => (
    <label className="flex items-center gap-2 min-h-[1.5rem] p-0.5 px-1 rounded-md hover:bg-dark-ui focus-within:bg-dark-ui cursor-pointer">
      <input
        type="checkbox"
        className="accent-dark-ui text-dark-tx-2"
        checked={!!displayValue}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={!onChange}
      />
    </label>
  ),
  object: ({ value }) => (
    <pre className="flex-1 max-w-full whitespace-pre-wrap break-words text-dark-tx-2">
      {JSON.stringify(value)}
    </pre>
  ),
};

export const PropertyDisplay = ({
  entry: [key, value],
  onChange,
}: {
  entry: [string, unknown];
  onChange?: (newValue: unknown) => void;
}) => {
  const type = value === null ? "object" : typeof value;
  const DisplayComponent = displayComponents[type];
  const [local, setLocal] = useState(value);
  const justSetRef = useRef(false);

  useEffect(() => {
    if (value !== local) {
      if (justSetRef.current) {
        justSetRef.current = false;
      } else {
        setLocal(value);
      }
    }
  }, [value, local]);

  const displayValue = type === "object" ? value : local;
  const handleChange =
    onChange &&
    (type === "string" || type === "number" || type === "boolean")
      ? (newVal: unknown) => {
          justSetRef.current = true;
          setLocal(newVal);
          onChange(newVal);
        }
      : undefined;

  return (
    <div className={cn("flex flex-row items-center w-full group gap-2 p-internal-sidebar font-semibold text-dark-tx-2")}>
      <h2>{key}:</h2>
      <div className=" flex-1">
        {DisplayComponent ? (
          DisplayComponent({
            value,
            displayValue,
            onChange: handleChange,
          })
        ) : (
          <p className={cn("truncate overflow-ellipsis text-dark-tx-2")}>{String(value)}</p>
        )}
      </div>
    </div>
  );
};

