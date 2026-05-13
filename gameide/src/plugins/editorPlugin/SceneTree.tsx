import {
  Box,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { IconSlug } from "../../lucide/lucideIconSlug.js";
import type { BaseSceneObject } from "../../scene/scene.js";
import { deselectObject } from "../../scene/objectSelection.js";
import { getScene } from "../../scene/scene.js";
import {
  deleteValueAtPath,
  getRecordAtPath,
  setValueAtPath,
} from "../../scene/path.js";
import { useScene } from "../../hooks/useScene.js";
import { useSelectedObject } from "../../hooks/useSelectedObject.js";
import { useTraits } from "../../hooks/useTraits.js";
import {
  SceneTreeRowIconFrame,
  sceneTreeRowIconFrameSizeClass,
} from "./SceneTreeRowIcon.js";
import { cn } from "../../utils/cn.js";

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
const muted = "text-[var(--vscode-descriptionForeground)]";
const foreground = "text-[var(--vscode-editor-foreground)]";
const rowHover = "hover:bg-[var(--vscode-list-hoverBackground)]";
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
  return (
    <div
      className={cn(
        "relative flex items-center justify-center self-center rounded p-0.5",
        sceneTreeRowIconFrameSizeClass,
        rowHover,
        "opacity-70 hover:opacity-100",
      )}
      title="Add child or trait"
    >
      <Plus
        size={iconSize}
        className={cn("block pointer-events-none", iconClass)}
        aria-hidden
      />
      <select
        aria-label="Add child or trait"
        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = "";
          if (v === "") return;
          if (v.startsWith("trait:")) {
            mergeTraitInto(objectPath, Number(v.slice("trait:".length)));
            return;
          }
          if (v === "obj" || v === "prop") {
            const key = window.prompt("Property name");
            if (key == null || key === "") return;
            let initial: unknown;
            if (v === "obj") {
              initial = {};
            } else {
              initial = null;
            }
            setAtPath(objectPath.concat(key), initial);
          }
        }}
      >
        <option value=""></option>
        <optgroup label="Property">
          <option value="obj">object</option>
          <option value="prop">property</option>
        </optgroup>
        {templates.length > 0 && (
          <optgroup label="Traits">
            {templates.map((t) => (
              <option key={t.id} value={`trait:${t.id}`}>
                {t.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
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
    <div className="min-w-0">
      <div
        className={cn(
          "group flex items-center gap-0.5 min-w-0 rounded",
          propertyRow ? "pl-2 pr-1.5" : "pl-1.5 pr-1.5",
          textSize,
          font,
          highlightable && rowHover,
          stickyStackDepth !== undefined &&
            "sticky bg-[var(--vscode-editor-background)]",
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
};

function PropertyNode({
  name,
  path,
  value,
  setAtPath,
  onDelete,
  templates,
  mergeTraitInto,
}: PropertyNodeProps) {
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
}: ObjectNodeProps) {
  const [open, setOpen] = useState(expandObjectsByDefault);
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
            expandObjectsByDefault={expandObjectsByDefault}
            depth={depth + 1}
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
      onHeaderClick={() => setOpen((o) => !o)}
      headerExpanded={open}
      stickyStackDepth={depth}
      label={
        <span className={cn("truncate font-medium", foreground)}>{name}</span>
      }
      body={childBody}
    />
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
}: TreeNodeProps) {
  const root = getScene() as Record<PropertyKey, unknown>;
  const onDelete = () => deleteValueAtPath(root, path);

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
      />
    );
  }

  return (
    <ObjectNode
      name={name}
      path={path}
      sceneObject={value as BaseSceneObject}
      setAtPath={setAtPath}
      onDelete={onDelete}
      templates={templates}
      mergeTraitInto={mergeTraitInto}
      expandObjectsByDefault={expandObjectsByDefault}
      depth={depth}
    />
  );
}

function formatScenePathSlash(pathKeys: PropertyKey[]): string {
  return pathKeys.map(String).join("/");
}

function elementIsTextInputLike(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function SceneTreeExitFocusButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center self-center rounded p-0.5",
        sceneTreeRowIconFrameSizeClass,
        rowHover,
        "opacity-70 hover:opacity-100",
      )}
      title="Deselect (Esc)"
    >
      <button
        type="button"
        aria-label="Deselect"
        className="absolute inset-0 cursor-pointer rounded border-0 bg-transparent p-0 outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]"
        onClick={onClick}
      />
      <X
        size={iconSize}
        className={cn("block pointer-events-none", iconClass)}
        aria-hidden
      />
    </div>
  );
}

function SceneViewHeader({
  title,
  trailing,
}: {
  title?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex w-full min-w-0 shrink-0 items-center gap-2 bg-[var(--vscode-editor-background)] pl-2 pr-1 pb-2 pt-2.5 text-xs leading-none",
        font,
        foreground,
      )}
    >
      <div className="min-w-0 flex-1 truncate leading-none">
        {title ?? (
          <span className="block min-w-0 truncate font-semibold">Scene</span>
        )}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-0.5">{trailing}</div>
      ) : null}
    </header>
  );
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

  let rootObject: BaseSceneObject | undefined;
  if (isExpandable(root)) {
    rootObject = root as BaseSceneObject;
  }

  const sceneRoot = getScene() as Record<PropertyKey, unknown>;
  let displayRoot: BaseSceneObject | undefined = rootObject;
  let nodePathPrefix: PropertyKey[] = [];

  if (rootObject && selectedPath?.length) {
    const sub = getRecordAtPath(sceneRoot, selectedPath);
    if (sub) {
      displayRoot = sub as BaseSceneObject;
      nodePathPrefix = selectedPath;
    }
  }

  const setAtPath = useCallback((scenePath: PropertyKey[], next: unknown) => {
    setValueAtPath(getScene() as Record<PropertyKey, unknown>, scenePath, next);
  }, []);

  const viewingSelectionSubtree = Boolean(selectedPath?.length);

  const headerTrailing = displayRoot ? (
    <>
      <div
        className={cn(
          !viewingSelectionSubtree && "invisible pointer-events-none",
        )}
      >
        <SceneTreeExitFocusButton onClick={() => deselectObject()} />
      </div>
      <ObjectAddSelect
        objectPath={nodePathPrefix}
        setAtPath={setAtPath}
        templates={templates}
        mergeTraitInto={mergeTraitInto}
      />
    </>
  ) : undefined;

  const headerTitle =
    viewingSelectionSubtree && selectedPath ? (
      <span
        className="block min-w-0 truncate font-semibold"
        title={formatScenePathSlash(selectedPath)}
      >
        {formatScenePathSlash(selectedPath)}
      </span>
    ) : (
      <span className="block min-w-0 truncate font-semibold">Scene</span>
    );

  if (!rootObject) {
    return (
      <div className="w-full h-full min-w-0 flex flex-col bg-[var(--vscode-editor-background)] p-2">
        <SceneViewHeader />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-w-0 flex flex-col bg-[var(--vscode-editor-background)] p-2">
      <SceneViewHeader title={headerTitle} trailing={headerTrailing} />
      <div className="flex-1 min-h-0 pt-2.5 overflow-auto">
        {displayRoot &&
          Object.keys(displayRoot).map((key) => (
            <TreeNode
              name={key}
              path={nodePathPrefix.concat(key)}
              value={displayRoot[key]}
              setAtPath={setAtPath}
              templates={templates}
              mergeTraitInto={mergeTraitInto}
              expandObjectsByDefault={viewingSelectionSubtree}
              key={key}
            />
          ))}
      </div>
    </div>
  );
}
