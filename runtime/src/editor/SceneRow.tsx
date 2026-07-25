import { cn } from "cnfast";
import { Box, ChevronRight, PlusIcon, Trash2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { addComponent } from "../component";
import { MeshComponent } from "../threePlugin/mesh";
import { TransformComponent } from "../threePlugin/transform";
import { IconButton } from "./IconButton";

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function parseInputValue(input: string): unknown {
  const trimmed = input.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  return input;
}

function useAutoSizeInput(value: string) {
  const ref = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const input = ref.current;

    if (!input) return;

    input.style.width = "0px";
    input.style.width = `${input.scrollWidth}px`;
  }, [value]);

  return ref;
}

function focusInputCenter(input: HTMLInputElement | null) {
  if (!input) return;

  input.focus();

  requestAnimationFrame(() => {
    const position = Math.floor(input.value.length / 2);
    input.setSelectionRange(position, position);
  });
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

  const [inputKey, setInputKey] = useState<string>();
  const [inputValue, setInputValue] = useState<string>();

  const displayKey = inputKey ?? String(key);
  const displayValue = inputValue ?? String(value);

  const keyInputRef = useAutoSizeInput(displayKey);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState(false);

  const canBeExpanded = isObject(value) && Object.keys(value).length > 0;

  function editKey() {
    const current = String(key);

    setInputKey(current);

    requestAnimationFrame(() => {
      focusInputCenter(keyInputRef.current);
    });
  }

  function editValue() {
    const current = String(value);

    setInputValue(current);

    requestAnimationFrame(() => {
      focusInputCenter(valueInputRef.current);
    });
  }

  function commitKey() {
    if (inputKey !== undefined && inputKey !== String(key)) {
      onKeyChange(inputKey);
    }
  }

  function commitValue() {
    if (inputValue !== undefined) {
      onValueChange(parseInputValue(inputValue));
    }
  }

  function finishKeyEdit() {
    commitKey();
    setInputKey(undefined);
  }

  function finishValueEdit() {
    commitValue();
    setInputValue(undefined);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>, commit: () => void) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();

    commit();
  }

  function handleEnter(event: React.KeyboardEvent) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();

    if (isObject(value)) {
      editKey();
    } else {
      editValue();
    }
  }

  return (
    <div className="flex flex-col">
      <button
        className="group flex flex-row items-center px-1.5 py-1 hover:bg-hover"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleEnter}
      >
        {isObject(value) && <Box className="size-4" />}

        <div className={cn(isObject(value) && "pl-1 flex-1 flex flex-row items-start")}>
          <input
            ref={keyInputRef}
            value={displayKey}
            onClick={(event) => event.stopPropagation()}
            onFocus={() => {
              setInputKey(String(key));
            }}
            onChange={(event) => {
              setInputKey(event.target.value);
            }}
            onKeyDown={(event) => handleInputKeyDown(event, commitKey)}
            onBlur={finishKeyEdit}
          />
        </div>

        {!isObject(value) && (
          <>
            <span className="w-min">:</span>

            <input
              ref={valueInputRef}
              className="text-emerald-200 flex-1"
              value={displayValue}
              onClick={(event) => event.stopPropagation()}
              onFocus={() => {
                setInputValue(String(value));
              }}
              onChange={(event) => {
                setInputValue(event.target.value);
              }}
              onKeyDown={(event) => handleInputKeyDown(event, commitValue)}
              onBlur={finishValueEdit}
            />
          </>
        )}

        <div
          className="flex flex-row items-center opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {canBeExpanded && (
            <IconButton
              icon={ChevronRight}
              className={cn(expanded && "rotate-90")}
              onClick={() => setExpanded(!expanded)}
            />
          )}

          {isObject(value) && (
            <IconButton
              icon={PlusIcon}
              onClick={() => {
                addComponent(value, TransformComponent, {});
                addComponent(value, MeshComponent, {});
              }}
            />
          )}

          <IconButton
            icon={Trash2Icon}
            onClick={() => {
              delete parent[key];
            }}
          />
        </div>
      </button>

      {expanded && isObject(value) && (
        <div className="pl-3 flex flex-col">
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
