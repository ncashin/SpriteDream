import { useState } from "react";

function parseInputValue(input: string): unknown {
  const trimmed = input.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  if (!(trimmed === "") && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  return input;
}

export default function SceneRow({
  entry,
  onKeyChange,
  onValueChange,
}: {
  entry: [PropertyKey, unknown];
  onKeyChange: (arg0: string) => void;
  onValueChange: (arg0: unknown) => void;
}) {
  const [key, value] = entry;

  const [inputKey, setInputKey] = useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);

  const isObject = !!value && typeof value === "object";

  const displayKey = inputKey ?? String(key);
  const displayValue = inputValue ?? String(value);

  return (
    <div className="flex flex-col pb-2">
      <div className="flex flex-row">
        <input
          value={displayKey}
          onFocus={() => {
            setInputKey(String(key));
          }}
          onChange={(event) => {
            setInputKey(event.target.value);
          }}
          onBlur={() => {
            if (inputKey !== undefined) {
              onKeyChange(inputKey);
            }
            setInputKey(undefined);
          }}
          style={{
            width: `${Math.max(displayKey.length, 1)}ch`,
          }}
        />

        {!isObject && (
          <>
            <span>:</span>
            <input
              value={displayValue}
              onFocus={() => {
                setInputValue(String(displayValue));
              }}
              onChange={(event) => {
                setInputValue(event.target.value);
              }}
              onBlur={() => {
                if (inputValue) {
                  onValueChange(parseInputValue(inputValue));
                }
                setInputValue(undefined);
              }}
              style={{
                width: `${Math.max(displayValue.length, 1)}ch`,
              }}
            />
          </>
        )}
      </div>

      <div className="pl-2.5">
        {isObject &&
          Object.entries(value).map(([childKey, childValue]) => (
            <SceneRow
              key={childKey}
              entry={[childKey, childValue]}
              onKeyChange={(newKey) => {
                const existingValue = childValue[childKey];
                delete childValue[childKey];
                childValue[newKey] = existingValue;
              }}
              onValueChange={(newValue) => {
                childValue[childKey] = newValue;
              }}
            />
          ))}
      </div>
    </div>
  );
}
