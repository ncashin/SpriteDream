import { useEffect, useRef, useState } from "react";
import type React from "react";

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
      className="min-w-96 bg-transparent min-w-full cursor-pointer focus:outline-none focus:text-light-ui focus:bg-dark-ui hover:bg-dark-ui p-0.5 px-1 rounded-md flex-1 transition-colors truncate overflow-ellipsis"
      value={displayValue as string}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={!onChange}
    />
  ),
  number: ({ displayValue, onChange }) => (
    <input
      type="number"
      className="bg-transparent focus:outline-none flex-1"
      value={displayValue as number}
      onChange={(e) => onChange?.(Number(e.target.value))}
      readOnly={!onChange}
    />
  ),
  boolean: ({ displayValue, onChange }) => (
    <input
      type="checkbox"
      className="accent-dark-ui"
      checked={!!displayValue}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={!onChange}
    />
  ),
  object: ({ value }) => (
    <pre className="flex-1 max-w-full whitespace-pre-wrap break-words">
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
    <div className="flex flex-row items-center w-full group gap-2 p-internal-sidebar font-semibold text-dark-tx-2">
      <h2>{key}:</h2>
      <div className=" flex-1">
        {DisplayComponent ? (
          DisplayComponent({
            value,
            displayValue,
            onChange: handleChange,
          })
        ) : (
          <p className="truncate overflow-ellipsis">{String(value)}</p>
        )}
      </div>
    </div>
  );
};

