import type { Key } from "@react-types/shared";
import { cn } from "cnfast";
import { Box, ChevronRight, PlusIcon, Trash2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Collection, Tree, TreeItem, TreeItemContent } from "react-aria-components";

import { isSerializableObject, type Serializable, type SerializableObject } from "../scene";

import { IconButton } from "./IconButton";

function parseInputValue(input: string): Serializable {
  const trimmed = input.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return input;
  }
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

export function ObjectRow({
  id,
  parent,
  entry,
  expandedKeys,
  onKeyChange,
  onValueChange,
}: {
  id: string;
  parent: SerializableObject;
  entry: [string, Serializable];
  expandedKeys: Set<Key>;
  onKeyChange: (arg0: string) => void;
  onValueChange: (arg0: Serializable) => void;
}) {
  const [key, value] = entry;

  const [inputKey, setInputKey] = useState<string>();
  const [inputValue, setInputValue] = useState<string>();

  const displayKey = inputKey ?? String(key);
  const displayValue = inputValue ?? String(value);

  const keyInputRef = useAutoSizeInput(displayKey);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const expanded = expandedKeys.has(id);

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

    if (isSerializableObject(value)) {
      editKey();
      return;
    }

    editValue();
  }

  const entries = isSerializableObject(value) ? Object.entries(value) : [];
  const canBeExpanded = entries.length > 0;

  return (
    <TreeItem id={id} textValue={key} hasChildItems={canBeExpanded} className="flex flex-col">
      <TreeItemContent>
        {({ hasChildItems }) => (
          <div
            className="group pl-[--spacing(calc((var(--tree-item-level)-1)*3))]"
            onKeyDown={handleEnter}
          >
            <div className=" row">
              <div className={cn(hasChildItems && "flex-1 flex flex-row items-center")}>
                {hasChildItems && <Box className="icon-size mr-1" />}

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

                {!hasChildItems && <span className="w-min">:</span>}
              </div>

              {!isSerializableObject(value) && (
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
              )}

              <div
                className="flex flex-row items-center opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                {canBeExpanded && (
                  <IconButton
                    icon={ChevronRight}
                    slot="chevron"
                    className={cn(expanded && "rotate-90")}
                  />
                )}

                {isSerializableObject(value) && <IconButton icon={PlusIcon} onClick={() => {}} />}

                <IconButton
                  icon={Trash2Icon}
                  onClick={() => {
                    delete parent[key];
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </TreeItemContent>

      <Collection items={entries}>
        {([childKey, childValue]) => (
          <ObjectRow
            key={childKey}
            id={`${id}.${childKey}`}
            parent={value}
            entry={[childKey, childValue]}
            expandedKeys={expandedKeys}
            onKeyChange={(newKey) => {
              const existingValue = value[childKey];

              delete value[childKey];
              value[newKey] = existingValue;
            }}
            onValueChange={(newValue) => {
              value[childKey] = newValue;
            }}
          />
        )}
      </Collection>
    </TreeItem>
  );
}

export default function ObjectTree({ object }: { object: SerializableObject }) {
  const entries = Object.entries(object);

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());

  return (
    <Tree
      aria-label="Selected Object Viewer"
      expandedKeys={expandedKeys}
      onExpandedChange={setExpandedKeys}
    >
      <Collection items={entries}>
        {([childKey, childValue]) => (
          <ObjectRow
            key={childKey}
            id={childKey}
            parent={object}
            entry={[childKey, childValue]}
            expandedKeys={expandedKeys}
            onKeyChange={(newKey) => {
              const existingValue = object[childKey];

              delete object[childKey];
              object[newKey] = existingValue;
            }}
            onValueChange={(newValue) => {
              object[childKey] = newValue;
            }}
          />
        )}
      </Collection>
    </Tree>
  );
}
