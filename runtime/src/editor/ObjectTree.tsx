import type { Key } from "@react-types/shared";
import { cn } from "cnfast";
import { Box, ChevronRight, PlusIcon, Trash2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
} from "react-aria-components";

import { isSerializableObject, type Serializable, type SerializableObject } from "../scene";

import { IconButton } from "./IconButton";
import { reorderObjectKeys } from "./reorderHelper";

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

export type AutoSizeInputProperties = {
  value: string;
  onCommit: (value: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>;

function AutoSizeInput({ value, onCommit, ...props }: AutoSizeInputProperties) {
  const [draft, setDraft] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const editingRef = useRef(false);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const measure = measureRef.current;

    if (!input || !measure) return;

    input.style.width = `${measure.offsetWidth}px`;
  }, [draft]);

  function focusCenter() {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
  }

  function startEdit() {
    editingRef.current = true;
    setDraft(value);

    requestAnimationFrame(focusCenter);
  }

  function commit() {
    editingRef.current = false;

    if (draft !== value) {
      onCommit(draft);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    commit();
    inputRef.current?.blur();
  }

  return (
    <>
      <span
        ref={measureRef}
        className="absolute invisible whitespace-pre font-inherit text-inherit tracking-inherit"
      >
        {draft || " "}
      </span>

      <input
        {...props}
        ref={inputRef}
        value={draft}
        onFocus={startEdit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </>
  );
}

export function ObjectRow({
  id,
  parent,
  entry,
  onKeyChange,
  onValueChange,
}: {
  id: string;
  parent: SerializableObject;
  entry: [string, Serializable];
  onKeyChange: (arg0: string) => void;
  onValueChange: (arg0: Serializable) => void;
}) {
  const [key, value] = entry;

  const entries = isSerializableObject(value) ? Object.entries(value) : [];
  const canBeExpanded = entries.length > 0;

  return (
    <TreeItem id={id} textValue={key} hasChildItems={canBeExpanded} className="flex flex-col">
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <div className="group pl-[--spacing(calc((var(--tree-item-level)-1)*3))]">
            <div className="row">
              <div className={cn(hasChildItems && "flex-1 flex flex-row items-center")}>
                {hasChildItems && <Box className="icon-size mr-1" />}

                <AutoSizeInput value={key} onCommit={onKeyChange} />

                {!hasChildItems && <span className="w-min">:</span>}
              </div>

              {!isSerializableObject(value) && (
                <AutoSizeInput
                  className="flex-1 text-emerald-200"
                  value={String(value)}
                  onCommit={onValueChange}
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
                    className={cn(isExpanded && "rotate-90")}
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
            onKeyChange={(newKey) => {
              console.log(newKey);
              const existingValue = value[childKey];

              delete value[childKey];
              value[newKey] = existingValue;
            }}
            onValueChange={(newValue) => {
              value[childKey] = parseInputValue(String(newValue));
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

  const { dragAndDropHooks } = useDragAndDrop({
    getItems(keys) {
      return [...keys].map((key) => ({
        "text/plain": String(key),
      }));
    },

    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className={({ isDropTarget }) =>
            cn("h-0.5 bg-blue-500 rounded-full", isDropTarget && "opacity-100")
          }
        />
      );
    },

    async onMove(event) {
      const targetKey = String(event.target.key);

      for (const key of event.keys) {
        const draggedKey = String(key);

        if (draggedKey === targetKey) continue;

        console.log(object);

        reorderObjectKeys(
          object,
          draggedKey,
          targetKey,
          event.target.dropPosition === "after" ? "after" : "before",
        );
        console.log(object);
      }
    },
  });

  return (
    <Tree
      aria-label="Selected Object Viewer"
      expandedKeys={expandedKeys}
      onExpandedChange={setExpandedKeys}
      dragAndDropHooks={dragAndDropHooks}
    >
      <Collection items={entries}>
        {([childKey, childValue]) => (
          <ObjectRow
            key={childKey}
            id={childKey}
            parent={object}
            entry={[childKey, childValue]}
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
