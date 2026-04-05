import { ChevronRight, Box } from "lucide-react";
import { useState, useEffect, type CSSProperties } from "react";
import type { SceneObject } from "../scene/scene.js";
import { useScene } from "./useScene.js";
import { cn } from "../utils/cn.js";

function isExpandable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValue(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `[${value.length}]`;
  return String(value);
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
const muted = "text-[var(--vscode-descriptionForeground)]";
const foreground = "text-[var(--vscode-editor-foreground)]";
const hover = "hover:bg-[var(--vscode-list-hoverBackground)]";

type TreeNodeProps = { name: string; depth: number; path: PropertyKey[] };

function TreeNode({ name, depth, path }: TreeNodeProps) {
  const fullPath = path.concat(name);
  const [value, setValue] = useScene(fullPath);
  const [open, setOpen] = useState(depth < 2);
  const [editText, setEditText] = useState(() => formatValue(value));
  const expandable = isExpandable(value);
  const obj = expandable ? (value as SceneObject) : null;
  const keys = obj ? Object.keys(obj) : [];
  useEffect(() => {
    setEditText(formatValue(value));
  }, [value]);

  const commitEdit = () => setValue(parseInput(editText));

  const leftPadding = { paddingLeft: `calc(0.375rem + ${depth}rem)` };
  const stickyStyle =
    expandable && open
      ? {
          top: `calc(${depth} * var(--scene-tree-row-height))`,
          zIndex: 100 - depth,
        }
      : {};
  const inputClass = `w-full min-w-0 flex-1 py-0 border-0 bg-transparent text-inherit ${textSize} font-[inherit] outline-none`;

  if (!expandable) {
    return (
      <div className={cn(rowClass, "gap-1 justify-start")} style={leftPadding}>
        <span className={cn(muted, "shrink-0")}>{name}:</span>
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditText(formatValue(value));
          }}
          className={inputClass}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div
        className={cn(
          rowClass,
          "gap-1 justify-between",
          expandable && open && "sticky top-0 bg-[var(--vscode-editor-background)]"
        )}
        style={{ ...leftPadding, ...stickyStyle }}
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
            hover
          )}
        >
          <Box size={12} className="shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <ChevronRight size={12} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
        </div>
      </div>
      {open && keys.map((k) => <TreeNode name={k} depth={depth + 1} path={fullPath} key={k} />)}
    </div>
  );
}

export function SceneTree() {
  const [root] = useScene([]);
  const rootObj = isExpandable(root) ? (root as SceneObject) : undefined;

  if (!rootObj || Object.keys(rootObj).length === 0) {
    return (
      <div className={cn("w-full flex items-center", textSize, font, muted)}>
        {!rootObj ? "No scene data" : "Scene is empty"}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-w-0 flex flex-col gap-0">
      <header className={cn("font-bold text-base py-1.5 pl-1.5 pt-3.5 text-xs", font)}>Scene View</header>
      <div className="flex-1 min-h-0 overflow-auto relative" style={{ "--scene-tree-row-height": "1.5rem" } as CSSProperties}>
        {Object.keys(rootObj).map((k) => (
          <TreeNode name={k} depth={0} path={[]} key={k} />
        ))}
      </div>
    </div>
  );
}
