import { ChevronRight, Box } from "lucide-react";
import { useRef, useState } from "react";
import type { SceneObject } from "../scene/scene.js";
import { getScene } from "../scene/scene.js";
import { setValueAtPath } from "../scene/scenePath.js";
import { useResizeObserverSetCSSVar } from "./useResizeObserverSetCSSVar.js";
import { useScene } from "./useScene.js";
import { cn } from "../utils/cn.js";

function isExpandable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValue(value: unknown): string {
  if (value == null) return value === null ? "null" : "undefined";
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
  return Number.isNaN(n) ? t : n;
}

const textSize = "text-xs";
const iconSize = 16;
const font = "font-[var(--vscode-font-family)]";
const treeGridClass =
  "grid grid-cols-[auto_minmax(0,1fr)] gap-x-0 w-full min-w-0 items-start";
const treeRowPad = "py-1.5 px-3";
const muted = "text-[var(--vscode-descriptionForeground)]";
const foreground = "text-[var(--vscode-editor-foreground)]";
const hover = "hover:bg-[var(--vscode-list-hoverBackground)]";
const inputClass = `w-full min-w-0 flex-1 py-0 border-0 bg-transparent text-inherit ${textSize} font-[inherit] outline-none`;

const internalPadding = "pl-2 pr-2.5 py-1.5";

type PropertyNodeProps = {
  name: string;
  path: PropertyKey[];
  value: unknown;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
};

function PropertyNode({ name, path, value, setAtPath }: PropertyNodeProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayText = draft ?? formatValue(value);
  const commitEdit = () => {
    setAtPath(path, parseInput(displayText));
    setDraft(null);
  };

  return (
    <div className={cn(internalPadding, "w-full flex items-center gap-1")}>
      <span className={cn(muted, "shrink-0")}>{name}:</span>
      <input
        type="text"
        value={displayText}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEdit();
          if (e.key === "Escape") setDraft(null);
        }}
        className={inputClass}
      />
    </div>
  );
}

function SceneViewHeader() {
  return (
    <header
      className={cn(
        "w-full flex items-center font-bold pt-2 pb-2 pl-3 pt-3.5 text-xs",
        font,
      )}
    >
      Scene View
    </header>
  );
}

type ObjectNodeProps = {
  name: string;
  depth: number;
  path: PropertyKey[];
  sceneObject: Record<string, unknown>;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
};

function ObjectNode({
  name,
  depth,
  path,
  sceneObject,
  setAtPath,
}: ObjectNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const keys = Object.keys(sceneObject);

  const stickyStyle = {
    top: `calc(${depth} * var(--scene-tree-row-height))`,
    zIndex: 100 - depth,
  };

  return (
    <div className={cn(treeGridClass, textSize, font)}>
      <div
        data-scene-tree-sticky-row=""
        className={cn(
          "col-span-2 grid grid-cols-subgrid items-center min-w-0",
          treeRowPad,
          textSize,
          font,
          open && "sticky bg-[var(--vscode-editor-background)]",
        )}
        style={open ? stickyStyle : undefined}
      >
        <div className={cn("p-1.5 rounded -ml-1.5", hover)}>
          <Box size={iconSize} />
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((open) => !open);
            }
          }}
          className={cn(
            internalPadding,
            "group flex flex-row items-center gap-1 min-w-0 rounded cursor-pointer outline-none",
            foreground,
            hover,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <ChevronRight
            size={iconSize - 2}
            className={cn(
              "shrink-0 transition-[transform,opacity] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              open && "rotate-90",
            )}
          />
        </div>
      </div>
      {open && (
        <div className="col-start-2 min-w-0">
          {keys.map((key) => (
            <TreeNode
              name={key}
              depth={depth + 1}
              path={path.concat(key)}
              value={sceneObject[key]}
              setAtPath={setAtPath}
              key={key}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type TreeNodeProps = {
  name: string;
  depth: number;
  path: PropertyKey[];
  value: unknown;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
};

function TreeNode({ name, depth, path, value, setAtPath }: TreeNodeProps) {
  if (!isExpandable(value)) {
    return (
      <PropertyNode
        name={name}
        path={path}
        value={value}
        setAtPath={setAtPath}
      />
    );
  }

  return (
    <ObjectNode
      name={name}
      depth={depth}
      path={path}
      sceneObject={value as SceneObject}
      setAtPath={setAtPath}
    />
  );
}

export function SceneTree() {
  const [root] = useScene();
  const rootObject = isExpandable(root) ? (root as SceneObject) : undefined;
  const scrollRef = useRef<HTMLDivElement>(null);

  useResizeObserverSetCSSVar(
    scrollRef,
    "--scene-tree-row-height",
    "[data-scene-tree-sticky-row]",
    [root],
  );

  const setAtPath = (scenePath: PropertyKey[], next: unknown) =>
    setValueAtPath(getScene() as Record<PropertyKey, unknown>, scenePath, next);

  return (
    <div className="w-full h-full min-w-0 flex flex-col gap-0">
      <SceneViewHeader />
      {rootObject && (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative">
          {Object.keys(rootObject).map((key) => (
            <TreeNode
              name={key}
              depth={0}
              path={[key]}
              value={rootObject[key]}
              setAtPath={setAtPath}
              key={key}
            />
          ))}
        </div>
      )}
    </div>
  );
}
