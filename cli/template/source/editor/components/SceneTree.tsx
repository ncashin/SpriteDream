import { ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import {
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useScene, useSelectedObject, useTraits } from "gameide";
import { PropertyInput } from "./PropertyInput.js";
import { Dropdown } from "./Dropdown.js";
import { IconButton } from "./IconButton.js";
import { cn } from "../../utils/cn.js";
import { fuzzyScore } from "../../utils/fuzzyMatch.js";
import { SceneIcon } from "./SceneIcon.js";

const sceneRowClassName = cn(
  "group flex min-h-[calc(1lh+0.5rem)] items-center gap-1 pl-2 pr-1 py-1",
  "text-xs font-[var(--vscode-font-family)] text-[var(--color-text)]",
  "hover:bg-[var(--color-hover)] focus-within:bg-[var(--color-hover)]",
);

function KeyInput({
  name,
  renameKey,
  className,
}: {
  name: string;
  renameKey: (newKey: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const skipCommitOnBlurRef = useRef(false);
  const text = draft ?? name;

  const commitEdit = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== name) renameKey(trimmed);
    setDraft(null);
  };

  const endEdit = () => {
    if (skipCommitOnBlurRef.current) {
      skipCommitOnBlurRef.current = false;
      setDraft(null);
      return;
    }
    commitEdit();
  };

  const stopRowToggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  return (
    <span className={cn("relative inline-flex max-w-full min-w-0", className)}>
      <span
        aria-hidden="true"
        className="invisible whitespace-pre font-[inherit] pointer-events-none"
      >
        {text || "\u00a0"}
      </span>
      <input
        type="text"
        value={text}
        onFocus={(e) => {
          stopRowToggle(e);
          setDraft(name);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={endEdit}
        onClick={stopRowToggle}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            skipCommitOnBlurRef.current = true;
            e.currentTarget.blur();
          }
        }}
        className="absolute inset-0 w-full min-w-0 border-0 bg-transparent outline-none font-[inherit] text-inherit"
      />
    </span>
  );
}

function isPathPrefix(prefix: PropertyKey[], path: PropertyKey[]): boolean {
  if (path.length < prefix.length) return false;
  return prefix.every((segment, i) => segment === path[i]);
}

function subtreeMatches(
  path: PropertyKey[],
  value: unknown,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const name = String(path[path.length - 1] ?? "");
  if (fuzzyScore(trimmed, name) != null) return true;
  if (typeof value === "string" && fuzzyScore(trimmed, value) != null) {
    return true;
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of Object.keys(value as object)) {
      if (
        subtreeMatches(
          [...path, key],
          (value as Record<string, unknown>)[key],
          trimmed,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function AddToSceneDropdown({
  path,
  open,
  onOpenChange,
  children,
  className,
  onAdded,
}: {
  path: PropertyKey[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  onAdded?: () => void;
}) {
  const { addChild } = useScene(path);
  const { traits, mergeTraitInto } = useTraits();

  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      options={[
        { value: "__new_object__", label: "New Object" },
        { value: "__new_property__", label: "New Property" },
        ...traits.map((t) => ({
          value: String(t.id),
          label: t.label,
        })),
      ]}
      onChange={(value) => {
        if (value === "__new_object__") {
          addChild({});
          onAdded?.();
          return;
        }
        if (value === "__new_property__") {
          addChild("");
          onAdded?.();
          return;
        }
        mergeTraitInto(path, Number(value));
      }}
      emptyMessage="No traits found"
      className={className}
    >
      {children}
    </Dropdown>
  );
}

function TreeNode({
  path,
  depth = 0,
  defaultExpanded = true,
  searchQuery = "",
}: {
  path: PropertyKey[];
  depth?: number;
  defaultExpanded?: boolean;
  searchQuery?: string;
}) {
  const { value, setValue, deleteValue, renameKey } = useScene(path);
  const { selectedPath } = useSelectedObject();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const name = String(path[path.length - 1] ?? "Scene");
  const isObject = value !== null && typeof value === "object";
  const childKeys = isObject ? Object.keys(value) : [];
  const icon = isObject ? Reflect.get(value, "__icon") : undefined;
  const isSelected =
    selectedPath &&
    path.length === selectedPath.length &&
    isPathPrefix(path, selectedPath);
  const ancestorOfSelection = selectedPath && isPathPrefix(path, selectedPath);
  const hasActiveSearch = searchQuery.trim().length > 0;
  const hasMatchingDescendant =
    hasActiveSearch &&
    isObject &&
    childKeys.some((key) =>
      subtreeMatches(
        [...path, key],
        (value as Record<string, unknown>)[key],
        searchQuery,
      ),
    );
  const isOpen =
    expanded ||
    (ancestorOfSelection && !userCollapsed) ||
    (hasActiveSearch && hasMatchingDescendant);

  if (hasActiveSearch && !subtreeMatches(path, value, searchQuery)) {
    return null;
  }

  const toggleExpanded = () => {
    if (isOpen) {
      setExpanded(false);
      if (ancestorOfSelection) setUserCollapsed(true);
      return;
    }
    setExpanded(true);
    setUserCollapsed(false);
  };

  const onAdded = () => {
    setExpanded(true);
    setUserCollapsed(false);
    setAddOpen(false);
  };

  return (
    <div>
      <div
        className="sticky bg-[var(--color-bg)]"
        style={{
          top: `calc(${depth + 2} * (1lh + 0.5rem) + 1rem)`,
          zIndex: 100 - depth,
        }}
      >
        <div
          className={cn(
            sceneRowClassName,
            isSelected && "bg-[var(--color-selection)]",
            addOpen && "bg-[var(--color-hover)]",
            isObject && "cursor-pointer",
          )}
          onClick={isObject ? toggleExpanded : undefined}
        >
          {isObject ? (
            <>
              <SceneIcon name={icon} />
              <KeyInput
                name={name}
                renameKey={renameKey}
                className="shrink-0 text-[var(--color-text)]"
              />
              <div
                className={cn(
                  "ml-auto flex shrink-0 flex-row opacity-0 pointer-events-none",
                  "group-hover:opacity-100 group-hover:pointer-events-auto",
                  "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                  addOpen && "opacity-100 pointer-events-auto",
                )}
              >
                <AddToSceneDropdown
                  path={path}
                  open={addOpen}
                  onOpenChange={setAddOpen}
                  onAdded={onAdded}
                >
                  <IconButton
                    aria-label="Add property"
                    aria-expanded={addOpen}
                    className={cn(
                      addOpen &&
                        "bg-[var(--color-hover)] hover:bg-[var(--color-hover)]",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddOpen((o) => !o);
                    }}
                  >
                    <Plus size={14} className="text-white" aria-hidden />
                  </IconButton>
                </AddToSceneDropdown>
                <IconButton
                  aria-label="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteValue();
                  }}
                >
                  <Trash2 size={14} className="text-white" aria-hidden />
                </IconButton>
                <IconButton
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded();
                  }}
                >
                  <ChevronRight
                    size={14}
                    className={cn(
                      "text-white transition-transform duration-150 ease-out",
                      isOpen && "rotate-90",
                    )}
                    aria-hidden
                  />
                </IconButton>
              </div>
            </>
          ) : (
            <>
              <KeyInput
                name={name}
                renameKey={renameKey}
                className="shrink-0 text-[var(--color-muted)]"
              />
              <PropertyInput value={value} setValue={setValue} />
              <div
                className={cn(
                  "ml-auto flex shrink-0 flex-row opacity-0 pointer-events-none",
                  "group-hover:opacity-100 group-hover:pointer-events-auto",
                  "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                )}
              >
                <IconButton
                  aria-label="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteValue();
                  }}
                >
                  <Trash2 size={14} className="text-white" aria-hidden />
                </IconButton>
              </div>
            </>
          )}
        </div>
      </div>
      {isOpen && childKeys.length > 0 && (
        <div className="pl-3.5 flex flex-col gap-0">
          {childKeys.map((key) => (
            <TreeNode
              key={String(key)}
              path={[...path, key]}
              depth={depth + 1}
              defaultExpanded={true}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneTree({ className }: { className?: string }) {
  const { value: root } = useScene([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "relative isolate flex-1 min-h-0 overflow-auto text-xs pb-24",
        className,
      )}
    >
      <div className="sticky top-0 z-[100] bg-[var(--color-bg)]">
        <div className="flex flex-col pb-4">
          <div className={sceneRowClassName}>
            <span
              className="relative flex size-3.5 shrink-0 items-center justify-center"
              aria-hidden
            >
              <Search size={14} className="text-white" />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              placeholder="Search Scene…"
              onChange={(event) => setSearchQuery(event.target.value)}
              className={cn(
                "min-w-0 flex-1 border-0 bg-transparent p-0 outline-none font-[inherit] leading-[inherit] text-inherit",
                "placeholder:text-[var(--color-muted)]",
                "[&::-webkit-search-cancel-button]:hidden",
              )}
            />
            {searchQuery ? (
              <IconButton
                aria-label="Clear search"
                className="size-3.5 p-0"
                onClick={() => {
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
              >
                <X size={14} aria-hidden />
              </IconButton>
            ) : null}
          </div>
          <AddToSceneDropdown
            path={[]}
            open={addOpen}
            onOpenChange={setAddOpen}
            className="w-full"
          >
            <button
              type="button"
              aria-label="Add to Scene"
              aria-haspopup="listbox"
              aria-expanded={addOpen}
              onClick={() => setAddOpen((open) => !open)}
              className={cn(
                sceneRowClassName,
                "w-full cursor-pointer border-0 bg-transparent",
                addOpen && "bg-[var(--color-hover)]",
              )}
            >
              <span
                className="relative flex size-3.5 shrink-0 items-center justify-center"
                aria-hidden
              >
                <Plus size={14} className="text-white" />
              </span>
              <span>Add to Scene</span>
            </button>
          </AddToSceneDropdown>
        </div>
      </div>
      {Object.keys(root ?? {}).map((key) => (
        <TreeNode
          key={key}
          path={[key]}
          defaultExpanded={false}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
}
