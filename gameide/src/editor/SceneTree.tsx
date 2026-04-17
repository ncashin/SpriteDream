import { ChevronRight, Box } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
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
const font = "font-[var(--vscode-font-family)]";
const rowClass = `flex flex-row items-center w-full min-w-0 py-1.5 pr-1.5 ${textSize} ${font} overflow-hidden`;
const leafKeyIndent = "0.375rem";
const muted = "text-[var(--vscode-descriptionForeground)]";
const foreground = "text-[var(--vscode-editor-foreground)]";
const hover = "hover:bg-[var(--vscode-list-hoverBackground)]";
const inputClass = `w-full min-w-0 flex-1 py-0 border-0 bg-transparent text-inherit ${textSize} font-[inherit] outline-none`;

type PropertyNodeProps = {
  name: string;
  style: CSSProperties;
  displayText: string;
  setDraft: (value: string | null) => void;
  commitEdit: () => void;
};

function PropertyNode({
  name,
  style,
  displayText,
  setDraft,
  commitEdit,
}: PropertyNodeProps) {
  return (
    <div
      className={cn(rowClass, "gap-1 justify-start")}
      style={style}
    >
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

type TreeNodeProps = {
  name: string;
  depth: number;
  path: PropertyKey[];
  value: unknown;
  setAtPath: (path: PropertyKey[], value: unknown) => void;
};

function TreeNode({ name, depth, path, value, setAtPath }: TreeNodeProps) {
  const setValue = (next: unknown) => setAtPath(path, next);
  const [open, setOpen] = useState(depth < 2);
  const [draft, setDraft] = useState<string | null>(null);
  const displayText = draft ?? formatValue(value);
  const expandable = isExpandable(value);
  const sceneObject = expandable ? value : null;
  const keys = sceneObject ? Object.keys(sceneObject) : [];

  const commitEdit = () => {
    setValue(parseInput(displayText));
    setDraft(null);
  };

  const leftPadding = { paddingLeft: `calc(0.375rem + ${depth}rem)` };
  const leafLeftPadding = {
    paddingLeft: `calc(0.375rem + ${depth}rem + ${leafKeyIndent})`,
  };
  const stickyStyle = { top: `calc(${depth} * var(--scene-tree-row-height))`, zIndex: 100 - depth }

  if (!expandable) {
    return (
      <PropertyNode
        name={name}
        style={leafLeftPadding}
        displayText={displayText}
        setDraft={setDraft}
        commitEdit={commitEdit}
      />
    );
  }

  return (
    <div className="min-w-0">
      <div
        data-scene-tree-sticky-row=""
        className={cn(
          rowClass,
          "gap-1 justify-between",
          expandable &&
            open &&
            "sticky bg-[var(--vscode-editor-background)]",
        )}
        style={{ ...leftPadding, ...(expandable && stickyStyle) }}
   
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className={cn(
            "flex flex-row items-center gap-1 min-w-0 flex-1 rounded py-1 px-1.5 -my-1 cursor-pointer outline-none",
            foreground,
            hover,
          )}
        >
          <Box size={12} className="shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <ChevronRight
            size={12}
            className={cn("shrink-0 transition-transform", open && "rotate-90")}
          />
        </div>
      </div>
      {open &&
        keys.map((key) => (
          <TreeNode
            name={key}
            depth={depth + 1}
            path={path.concat(key)}
            value={(sceneObject as SceneObject)[key]}
            setAtPath={setAtPath}
            key={key}
          />
        ))}
    </div>
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
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto relative"
        >
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
