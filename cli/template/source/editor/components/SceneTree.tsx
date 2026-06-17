import {
  Check,
  ChevronRight,
  Cog,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

const stopMousePropagation = (event: ReactMouseEvent) => {
  event.stopPropagation();
};

function isPathPrefix(prefix: PropertyKey[], path: PropertyKey[]): boolean {
  if (path.length < prefix.length) return false;
  return prefix.every((segment, i) => segment === path[i]);
}

function isHiddenPropertyKey(key: PropertyKey): boolean {
  return String(key).startsWith("__");
}

function filterVisibleKeys(
  keys: string[],
  showHiddenProperties: boolean,
): string[] {
  if (showHiddenProperties) return keys;
  return keys.filter((key) => !isHiddenPropertyKey(key));
}

function subtreeMatches(
  path: PropertyKey[],
  value: unknown,
  query: string,
  showHiddenProperties: boolean,
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
      if (!showHiddenProperties && isHiddenPropertyKey(key)) continue;
      if (
        subtreeMatches(
          [...path, key],
          (value as Record<string, unknown>)[key],
          trimmed,
          showHiddenProperties,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function SceneSettingsMenu({
  open,
  onOpenChange,
  showHiddenProperties,
  onShowHiddenPropertiesChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showHiddenProperties: boolean;
  onShowHiddenPropertiesChange: (value: boolean) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 2,
      right: window.innerWidth - rect.right,
      minWidth: "12rem",
      zIndex: 2147483647,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          onMouseDown={stopMousePropagation}
          onMouseUp={stopMousePropagation}
          onClick={stopMousePropagation}
          className={cn(
            "overflow-hidden border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)]",
            "bg-[var(--color-bg)] p-1 shadow-[0_4px_16px_var(--color-shadow)]",
          )}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={showHiddenProperties}
            onClick={() =>
              onShowHiddenPropertiesChange(!showHiddenProperties)
            }
            className={cn(
              "flex w-full min-w-0 items-center gap-2 py-1 pl-1.5 pr-1.5 text-left text-xs",
              "font-[var(--vscode-font-family)] cursor-pointer border-0 text-[var(--color-text)]",
              "bg-transparent hover:bg-[var(--color-hover)]",
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center border border-[var(--color-border)]",
                showHiddenProperties
                  ? "bg-[var(--color-highlight)] text-[var(--color-on-accent)]"
                  : "bg-transparent",
              )}
            >
              {showHiddenProperties ? (
                <Check size={12} strokeWidth={3} aria-hidden />
              ) : null}
            </span>
            <span className="min-w-0 truncate">Show hidden properties</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      ref={rootRef}
      onMouseDown={stopMousePropagation}
      onMouseUp={stopMousePropagation}
      onClick={stopMousePropagation}
      className="relative min-w-0 shrink-0"
    >
      {children}
      {menu}
    </div>
  );
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
          addChild("value");
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
  showHiddenProperties = false,
}: {
  path: PropertyKey[];
  depth?: number;
  defaultExpanded?: boolean;
  searchQuery?: string;
  showHiddenProperties?: boolean;
}) {
  const { value, setValue, deleteValue, renameKey } = useScene(path);
  const { selectedPath } = useSelectedObject();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const name = String(path[path.length - 1] ?? "Scene");
  const isObject = value !== null && typeof value === "object";
  const childKeys = isObject ? Object.keys(value) : [];
  const visibleChildKeys = filterVisibleKeys(childKeys, showHiddenProperties);
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
    visibleChildKeys.some((key) =>
      subtreeMatches(
        [...path, key],
        (value as Record<string, unknown>)[key],
        searchQuery,
        showHiddenProperties,
      ),
    );
  const isOpen =
    expanded ||
    (ancestorOfSelection && !userCollapsed) ||
    (hasActiveSearch && hasMatchingDescendant);

  if (
    hasActiveSearch &&
    !subtreeMatches(path, value, searchQuery, showHiddenProperties)
  ) {
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
          top: `calc(${depth + 1} * (1lh + 0.5rem))`,
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
      {isOpen && visibleChildKeys.length > 0 && (
        <div className="pl-3.5 flex flex-col gap-0">
          {visibleChildKeys.map((key) => (
            <TreeNode
              key={String(key)}
              path={[...path, key]}
              depth={depth + 1}
              defaultExpanded={true}
              searchQuery={searchQuery}
              showHiddenProperties={showHiddenProperties}
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showHiddenProperties, setShowHiddenProperties] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const actionsVisible = addOpen || settingsOpen;
  return (
    <div
      className={cn(
        "relative isolate flex-1 min-h-0 overflow-auto text-xs pb-24",
        className,
      )}
    >
      <div className="sticky top-0 z-[101] bg-[var(--color-bg)]">
        <div
          className={cn(
            sceneRowClassName,
            actionsVisible && "bg-[var(--color-hover)]",
          )}
        >
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
          <div
            className={cn(
              "ml-auto flex shrink-0 flex-row items-center",
              "opacity-0 pointer-events-none",
              "group-hover:opacity-100 group-hover:pointer-events-auto",
              "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
              actionsVisible && "opacity-100 pointer-events-auto",
            )}
          >
            {searchQuery ? (
              <IconButton
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
              >
                <X size={14} className="text-white" aria-hidden />
              </IconButton>
            ) : null}
            <AddToSceneDropdown
              path={[]}
              open={addOpen}
              onOpenChange={setAddOpen}
            >
              <IconButton
                aria-label="Add to Scene"
                aria-expanded={addOpen}
                className={cn(
                  addOpen &&
                    "bg-[var(--color-hover)] hover:bg-[var(--color-hover)]",
                )}
                onClick={() => setAddOpen((open) => !open)}
              >
                <Plus size={14} className="text-white" aria-hidden />
              </IconButton>
            </AddToSceneDropdown>
            <SceneSettingsMenu
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              showHiddenProperties={showHiddenProperties}
              onShowHiddenPropertiesChange={setShowHiddenProperties}
            >
              <IconButton
                aria-label="Scene settings"
                aria-expanded={settingsOpen}
                className={cn(
                  settingsOpen &&
                    "bg-[var(--color-hover)] hover:bg-[var(--color-hover)]",
                )}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Cog size={14} className="text-white" aria-hidden />
              </IconButton>
            </SceneSettingsMenu>
          </div>
        </div>
      </div>
      {filterVisibleKeys(Object.keys(root ?? {}), showHiddenProperties).map(
        (key) => (
          <TreeNode
            key={key}
            path={[key]}
            defaultExpanded={false}
            searchQuery={searchQuery}
            showHiddenProperties={showHiddenProperties}
          />
        ),
      )}
    </div>
  );
}
