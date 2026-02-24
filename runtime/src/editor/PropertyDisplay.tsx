import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { displayComponents } from "./inputs";

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
    <div className={cn(" flex flex-row items-center w-full group gap-2 p-internal-sidebar font-semibold text-dark-tx-2")}>
      <h2 className="w-16 min-w-16 truncate">{key}:</h2>
      <div className=" flex-1">
        {DisplayComponent ? (
          <DisplayComponent
            value={value}
            displayValue={displayValue}
            onChange={handleChange}
          />
        ) : (
          <p className={cn("truncate overflow-ellipsis text-dark-tx-2")}>{String(value)}</p>
        )}
      </div>
    </div>
  );
};

