import { cn } from "cnfast";
import { Box, ChevronRight, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { addComponent } from "../component";
import { MeshComponent } from "../threePlugin/mesh";
import { TransformComponent } from "../threePlugin/transform";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

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
  parent,
  entry,
  onKeyChange,
  onValueChange,
}: {
  parent: Record<PropertyKey, unknown>;
  entry: [PropertyKey, unknown];
  onKeyChange: (arg0: string) => void;
  onValueChange: (arg0: unknown) => void;
}) {
  const [key, value] = entry;

  const [inputKey, setInputKey] = useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);

  const displayKey = inputKey ?? String(key);
  const displayValue = inputValue ?? String(value);

  const canBeExpanded = isObject(value) && Object.keys(value).length > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        className="flex flex-row items-center gap-1 px-1.5 py-0.5 hover:bg-slate-100"
        onClick={() => setExpanded(!expanded)}
      >
        {isObject(value) && <Box className="size-4" />}
        <input
          className={cn(isObject(value) && "flex-1")}
          value={displayKey}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onFocus={() => {
            setInputKey(String(key));
          }}
          onChange={(event) => {
            setInputKey(event.target.value);
          }}
          onBlur={() => {
            if (inputKey !== undefined && inputKey !== key) {
              onKeyChange(inputKey);
            }
            setInputKey(undefined);
          }}
          style={{
            width: `${Math.max(displayKey.length, 1)}ch`,
          }}
        />
        {canBeExpanded && <ChevronRight className={cn("size-4", expanded && "rotate-90")} />}

        {!isObject(value) && (
          <>
            <span>:</span>
            <div className="flex-1">
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
            </div>
          </>
        )}

        {isObject(value) && (
          <PlusIcon
            className="size-4"
            onClick={() => {
              console.log("COMPONENT ADDITION TEST");
              addComponent(value, TransformComponent, {});
              addComponent(value, MeshComponent, {});
            }}
          />
        )}
        <Trash2Icon
          className="size-4"
          onClick={() => {
            delete parent[key];
          }}
        />
      </button>

      {expanded && isObject(value) && (
        <div className="pl-2.5">
          {Object.entries(value).map(([childKey, childValue]) => (
            <SceneRow
              key={childKey}
              parent={value}
              entry={[childKey, childValue]}
              onKeyChange={(newKey) => {
                const existingValue = value[childKey];
                delete value[childKey];
                value[newKey] = existingValue;
              }}
              onValueChange={(newValue) => {
                value[childKey] = newValue;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
