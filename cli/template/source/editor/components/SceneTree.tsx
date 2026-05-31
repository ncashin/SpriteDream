import {
  Box,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  deselectObject,
  getScene,
  setValueAtPath,
  useScene,
  useSelectedObject,
  useTraits,
  type GameObject,
} from "gameide";
import {
  SceneTreeRowIconFrame,
  sceneTreeRowIconFrameSizeClass,
} from "./SceneTreeRowIcon.js";
import { SearchDropdown } from "./SearchDropdown.js";
import { cn } from "../../utils/cn.js";

type IconSlug = string;

function isExpandable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValue(value: unknown): string {
  if (value == null) {
    if (value === null) return "null";
    return "undefined";
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") {
    try {
      return String(value);
    } catch {
      return "[Symbol]";
    }
  }
  if (typeof value === "function") {
    try {
      return Function.prototype.toString.call(value);
    } catch {
      return "[Function]";
    }
  }
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") {
    try {
      return Object.prototype.toString.call(value);
    } catch {
      return "[object]";
    }
  }
  return "";
}

function parseInput(s: string): unknown {
  const t = s.trim();
  if (t === "null") return null;
  if (t === "undefined") return undefined;
  if (t === "true") return true;
  if (t === "false") return false;
  const n = Number(t);
  if (Number.isNaN(n)) {
    return t;
  }
  return n;
}

const textSize = "text-xs";
const iconSize = 14;
const iconClass = "text-white";
const font = "font-[var(--vscode-font-family)]";
const muted = "text-[var(--color-muted)]";
const foreground = "text-[var(--color-fg)]";
const rowHover = "hover:bg-[var(--color-hover)]";
const inputClass = `w-full min-w-0 flex-1 py-0.5 border-0 bg-transparent text-inherit ${textSize} font-[inherit] outline-none`;

const SCENE_TREE_META_KEYS = new Set(["__icon"]);

/** Per nesting level for `position: sticky` object headers (matches row padding + icon frame). */
const SCENE_TREE_STICKY_STACK_REM = 1.75;

/** Scene-tree row icon when a nested object omits `__icon` (e.g. hand-authored collider payloads). */
const SCENE_OBJECT_PROPERTY_ICONS: Partial<Record<string, IconSlug>> = {
  boxCollider: "square",
  circleCollider: "circle",
  collisionBody: "atom",
  sprite: "image",
};

type LeadIconComponent = typeof Box;

function normalizeIconSlug(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.includes("-")) return t.toLowerCase();
  return t
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function SceneTreeObjectLeadIcon({ iconKey }: { iconKey: unknown }) {
  const [Icon, setIcon] = useState<LeadIconComponent>(() => Box);

  useEffect(() => {
    if (typeof iconKey !== "string" || iconKey.trim() === "") {
      setIcon(() => Box);
      return;
    }
    const slug = normalizeIconSlug(iconKey);
    const loaders = dynamicIconImports as Record<
      string,
      () => Promise<{ default: LeadIconComponent }>
    >;
    const load = loaders[slug];
    if (!load) {
      setIcon(() => Box);
      return;
    }
    let cancelled = false;
    void load()
      .then((mod) => {
        if (!cancelled && mod?.default) {
          setIcon(() => mod.default);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIcon(() => Box);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [iconKey]);

  const Cmp = Icon;
  return <Cmp size={iconSize} className={iconClass} aria-hidden />;
}

function ObjectAddSelect({
  objectPath,
  setAtPath,
  templates,
  mergeTraitInto,
}: {
  objectPath: PropertyKey[];
  setAtPath: (path: PropertyKey[], value: unknown) => void;
  templates: { id: number; label: string }[];
  mergeTraitInto: (path: PropertyKey[], traitId: number) => void;
}) {
  const options = [
    { value: "obj", label: "object", group: "Property" },
    { value: "prop", label: "property", group: "Property" },
    ...templates.map((template) => ({
      value: `trait:${template.id}`,
      label: template.label,
      group: "Traits",
    })),
  ];

  return (
    <SearchDropdown
      variant="icon"
      title="Add child or trait"
      ariaLabel="Add child or trait"
      searchPlaceholder="Search traits…"
      emptyMessage="No traits found"
      options={options}
      icon={
        <Plus
          size={iconSize}
          className={cn("block pointer-events-none", iconClass)}
          aria-hidden
        />
      }
      triggerClassName={cn(sceneTreeRowIconFrameSizeClass, rowHover)}
      onSelect={(value) => {
        if (value.startsWith("trait:")) {
          mergeTraitInto(objectPath, Number(value.slice("trait:".length)));
          return;
        }
        if (value === "obj" || value === "prop") {
          const key = window.prompt("Property name");
          if (key == null || key === "") return;
          const initial = value === "obj" ? {} : null;
          setAtPath(objectPath.concat(key), initial);
        }
      }}
    />
  );
}

type RowActionsProps = {
  path: PropertyKey[];
  isObject: boolean;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
  onDelete: () => void;
  templates: { id: number; label: string }[];
  mergeTraitInto: (path: PropertyKey[], traitId: number) => void;
};

function RowActions({
  path,
  isObject,
  setAtPath,
  onDelete,
  templates,
  mergeTraitInto,
}: RowActionsProps) {
  return (
    <div className="flex items-center gap-0 shrink-0">
      {isObject && (
        <ObjectAddSelect
          objectPath={path}
          setAtPath={setAtPath}
          templates={templates}
          mergeTraitInto={mergeTraitInto}
        />
      )}
      <button
        type="button"
        className={cn(
          "flex items-center justify-center p-0.5 rounded self-center",
          sceneTreeRowIconFrameSizeClass,
          rowHover,
          "opacity-70 hover:opacity-100",
        )}
        aria-label="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={iconSize} className={iconClass} />
      </button>
    </div>
  );
}

type RowShellProps = {
  path: PropertyKey[];
  isObject: boolean;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
  onDelete: () => void;
  templates: { id: number; label: string }[];
  mergeTraitInto: (path: PropertyKey[], traitId: number) => void;
  trailing?: ReactNode;
  label: ReactNode;
  body?: ReactNode;
  dropInto?: boolean;
  onHeaderClick?: (e: MouseEvent) => void;
  headerExpanded?: boolean;
  /** List-style hover background; off for property (non-object) rows. */
  highlightable?: boolean;
  propertyRow?: boolean;
  /** When `dropInto`, Lucide icon name/slug from scene `__icon` (kebab-case or PascalCase). */
  objectLeadIconKey?: unknown;
  /** When set, the header row sticks while scrolling the scene tree list. */
  stickyStackDepth?: number;
  selected?: boolean;
  rowRef?: RefObject<HTMLDivElement | null>;
};

function RowShell({
  path,
  isObject,
  setAtPath,
  onDelete,
  templates,
  mergeTraitInto,
  trailing,
  label,
  body,
  dropInto,
  onHeaderClick,
  headerExpanded,
  highlightable = true,
  propertyRow = false,
  objectLeadIconKey,
  stickyStackDepth,
  selected = false,
  rowRef,
}: RowShellProps) {
  let lead: ReactNode = null;
  if (dropInto) {
    lead = (
      <SceneTreeRowIconFrame>
        <SceneTreeObjectLeadIcon iconKey={objectLeadIconKey} />
      </SceneTreeRowIconFrame>
    );
  }

  let rowOnClick: ((e: MouseEvent) => void) | undefined;
  if (onHeaderClick) {
    rowOnClick = (e) => {
      if (
        (e.target as HTMLElement).closest(
          "button, input, select, textarea, option, a",
        )
      ) {
        return;
      }
      onHeaderClick(e);
    };
  }

  let ariaExpanded: boolean | undefined;
  if (onHeaderClick) {
    ariaExpanded = headerExpanded;
  }

  return (
    <div className="min-w-0" ref={rowRef}>
      <div
        className={cn(
          "group flex items-center gap-0.5 min-w-0 rounded",
          propertyRow ? "pl-2 pr-1.5" : "pl-1.5 pr-1.5",
          textSize,
          font,
          selected && "bg-[var(--color-selection)]",
          highlightable && !selected && rowHover,
          stickyStackDepth !== undefined &&
            "sticky bg-[var(--color-bg)]",
          selected && stickyStackDepth !== undefined &&
            "bg-[var(--color-selection)]",
        )}
        style={
          stickyStackDepth !== undefined
            ? {
                top: `calc(${stickyStackDepth} * ${SCENE_TREE_STICKY_STACK_REM}rem)`,
                zIndex: 20 + stickyStackDepth,
              }
            : undefined
        }
        aria-expanded={ariaExpanded}
        onClick={rowOnClick}
      >
        {lead}
        <div
          className={cn(
            "flex-1 min-w-0 flex items-center gap-1",
            propertyRow ? "py-1" : "py-1",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "flex items-center gap-0 shrink-0 opacity-0 pointer-events-none",
            "transition-opacity duration-150 ease-out",
            "group-hover:opacity-100 group-hover:pointer-events-auto",
            "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
          )}
        >
          <RowActions
            path={path}
            isObject={isObject}
            setAtPath={setAtPath}
            onDelete={onDelete}
            templates={templates}
            mergeTraitInto={mergeTraitInto}
          />
          {trailing}
        </div>
      </div>
      {body}
    </div>
  );
}

type PropertyNodeProps = {
  name: string;
  path: PropertyKey[];
  value: unknown;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
  onDelete: () => void;
  templates: { id: number; label: string }[];
  mergeTraitInto: (path: PropertyKey[], traitId: number) => void;
  selectedPath?: PropertyKey[] | null;
};

function PropertyNode({
  name,
  path,
  value,
  setAtPath,
  onDelete,
  templates,
  mergeTraitInto,
  selectedPath,
}: PropertyNodeProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selected = Boolean(selectedPath && pathsEqual(path, selectedPath));

  useLayoutEffect(() => {
    if (!selected) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, selectedPath]);

  const [draft, setDraft] = useState<string | null>(null);
  const skipCommitOnBlurRef = useRef(false);
  let displayText: string;
  if (draft !== null) {
    displayText = draft;
  } else {
    displayText = formatValue(value);
  }
  const commitEdit = () => {
    setAtPath(path, parseInput(displayText));
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

  return (
    <RowShell
      path={path}
      isObject={false}
      propertyRow
      highlightable={false}
      selected={selected}
      rowRef={rowRef}
      setAtPath={setAtPath}
      onDelete={onDelete}
      templates={templates}
      mergeTraitInto={mergeTraitInto}
      label={
        <>
          <span className={cn(muted, "shrink-0")}>{name}</span>
          <input
            type="text"
            value={displayText}
            onFocus={() => setDraft(formatValue(value))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={endEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                skipCommitOnBlurRef.current = true;
                e.currentTarget.blur();
              }
            }}
            className={inputClass}
          />
        </>
      }
    />
  );
}

type ObjectNodeProps = {
  name: string;
  path: PropertyKey[];
  sceneObject: Record<string, unknown>;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
  onDelete: () => void;
  templates: { id: number; label: string }[];
  mergeTraitInto: (path: PropertyKey[], traitId: number) => void;
  expandObjectsByDefault?: boolean;
  depth: number;
  selectedPath?: PropertyKey[] | null;
};

function ObjectNode({
  name,
  path,
  sceneObject,
  setAtPath,
  onDelete,
  templates,
  mergeTraitInto,
  expandObjectsByDefault = false,
  depth,
  selectedPath,
}: ObjectNodeProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selected = Boolean(selectedPath && pathsEqual(path, selectedPath));
  const selectionKey = selectedPath?.map(String).join("\0") ?? "";
  const autoOpen =
    expandObjectsByDefault || isSelectionRelatedPath(path, selectedPath);
  const [openOverride, setOpenOverride] = useState<{
    selectionKey: string;
    open: boolean;
  } | null>(null);
  const open =
    openOverride?.selectionKey === selectionKey ? openOverride.open : autoOpen;

  useLayoutEffect(() => {
    if (!selected) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, selectedPath, open]);

  const keys = Object.keys(sceneObject).filter((k) => !SCENE_TREE_META_KEYS.has(k));

  let childBody: ReactNode = null;
  if (open) {
    childBody = (
      <div className="min-w-0 pl-3">
        {keys.map((key) => (
          <TreeNode
            name={key}
            path={path.concat(key)}
            value={sceneObject[key]}
            setAtPath={setAtPath}
            templates={templates}
            mergeTraitInto={mergeTraitInto}
            expandObjectsByDefault={
              expandObjectsByDefault || isSelectionRelatedPath(path, selectedPath)
            }
            depth={depth + 1}
            selectedPath={selectedPath}
            key={key}
          />
        ))}
      </div>
    );
  }

  let chevronClass = cn(
    "block shrink-0 transition-transform pointer-events-none",
    iconClass,
  );
  if (open) {
    chevronClass = cn(chevronClass, "rotate-90");
  }

  return (
    <RowShell
      path={path}
      isObject
      selected={selected}
      rowRef={rowRef}
      setAtPath={setAtPath}
      onDelete={onDelete}
      templates={templates}
      mergeTraitInto={mergeTraitInto}
      dropInto
      objectLeadIconKey={
        sceneObject.__icon ?? SCENE_OBJECT_PROPERTY_ICONS[name]
      }
      trailing={
        <SceneTreeRowIconFrame>
          <ChevronRight size={iconSize} className={chevronClass} aria-hidden />
        </SceneTreeRowIconFrame>
      }
      onHeaderClick={() =>
        setOpenOverride({ selectionKey, open: !open })
      }
      headerExpanded={open}
      stickyStackDepth={depth}
      label={
        <span className={cn("truncate font-medium", foreground)}>{name}</span>
      }
      body={childBody}
    />
  );
}

function CreateObjectRow({
  setAtPath,
}: {
  setAtPath: (path: PropertyKey[], value: unknown) => void;
}) {
  return (
    <div className="min-w-0 shrink-0 pt-2 pb-2.5">
      <button
        type="button"
        aria-label="Create Object"
        onClick={() => {
          const key = window.prompt("Object name");
          if (key == null || key === "") return;
          setAtPath([key], {});
        }}
        className={cn(
          "flex w-full min-w-0 items-center justify-start gap-0.5 rounded pl-1.5 pr-1.5",
          textSize,
          font,
          rowHover,
        )}
      >
        <span className="flex w-[18px] shrink-0 justify-center self-center">
          <Plus size={iconSize} className={iconClass} aria-hidden />
        </span>
        <span className={cn("min-w-0 truncate py-1 font-bold", foreground)}>
          Create Object
        </span>
      </button>
    </div>
  );
}

type TreeNodeProps = {
  name: string;
  path: PropertyKey[];
  value: unknown;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
  templates: { id: number; label: string }[];
  mergeTraitInto: (path: PropertyKey[], traitId: number) => void;
  expandObjectsByDefault?: boolean;
  depth?: number;
  selectedPath?: PropertyKey[] | null;
};

function TreeNode({
  name,
  path,
  value,
  setAtPath,
  templates,
  mergeTraitInto,
  expandObjectsByDefault = false,
  depth = 0,
  selectedPath,
}: TreeNodeProps) {
  const root = getScene().get() as Record<PropertyKey, unknown>;
  const onDelete = () => setValueAtPath(root, path, undefined);

  if (!isExpandable(value)) {
    return (
      <PropertyNode
        name={name}
        path={path}
        value={value}
        setAtPath={setAtPath}
        onDelete={onDelete}
        templates={templates}
        mergeTraitInto={mergeTraitInto}
        selectedPath={selectedPath}
      />
    );
  }

  return (
    <ObjectNode
      name={name}
      path={path}
      sceneObject={value as GameObject}
      setAtPath={setAtPath}
      onDelete={onDelete}
      templates={templates}
      mergeTraitInto={mergeTraitInto}
      expandObjectsByDefault={expandObjectsByDefault}
      depth={depth}
      selectedPath={selectedPath}
    />
  );
}

function pathsEqual(a: PropertyKey[], b: PropertyKey[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function isSelectionRelatedPath(
  path: PropertyKey[],
  selectedPath: PropertyKey[] | null | undefined,
): boolean {
  if (!selectedPath?.length) return false;
  const shorter = path.length <= selectedPath.length ? path : selectedPath;
  const longer = path.length <= selectedPath.length ? selectedPath : path;
  return shorter.every((key, index) => key === longer[index]);
}

function elementIsTextInputLike(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function SceneTree() {
  const [root] = useScene();
  const { templates, mergeTraitInto } = useTraits();
  const { selectedPath } = useSelectedObject();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedPath?.length) return;
      if (e.key !== "Escape" && e.key !== "x" && e.key !== "X") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (elementIsTextInputLike(e.target as Element)) return;
      e.preventDefault();
      deselectObject();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPath]);

  let rootObject: GameObject | undefined;
  if (isExpandable(root)) {
    rootObject = root as GameObject;
  }

  const setAtPath = useCallback((scenePath: PropertyKey[], next: unknown) => {
    setValueAtPath(getScene().get() as Record<PropertyKey, unknown>, scenePath, next);
  }, []);

  if (!rootObject) {
    return null;
  }

  return (
    <>
      <CreateObjectRow setAtPath={setAtPath} />
      <div className="flex-1 min-h-0 overflow-auto">
        {Object.keys(rootObject).map((key) => (
          <TreeNode
            name={key}
            path={[key]}
            value={rootObject[key]}
            setAtPath={setAtPath}
            templates={templates}
            mergeTraitInto={mergeTraitInto}
            selectedPath={selectedPath}
            key={key}
          />
        ))}
      </div>
    </>
  );
}
