import { ChevronRight, Box } from "lucide-react";
import { useState, useEffect } from "react";
import type { SceneObject } from "../scene.js";
import { useScene } from "./useScene.js";
import { cn } from "../utils/cn.js";

function isExpandable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValue(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "string") return `"${value}"`;
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
const font = "font-[var(--vscode-font-family,monospace)]";
const rowClass = `flex flex-row items-center w-full min-w-0 h-6 ${textSize} ${font} overflow-hidden`;
const muted = "text-[var(--vscode-descriptionForeground,#6e7681)]";
const fg = "text-[var(--vscode-editor-foreground,#ccc)]";
const hover = "hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.08))]";

const depthPl = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16", "pl-20", "pl-24", "pl-28", "pl-32", "pl-36", "pl-40"] as const;
function plForDepth(depth: number): string {
  return depthPl[Math.min(depth, depthPl.length - 1)] ?? "pl-40";
}

type TreeNodeProps = { name: string; depth: number; path: PropertyKey[] };

function TreeNode({ name, depth, path }: TreeNodeProps) {
  const fullPath = path.concat(name);
  const [value, setValue] = useScene(fullPath);
  const [open, setOpen] = useState(depth < 2);
  const [editText, setEditText] = useState(() => formatValue(value));
  const expandable = isExpandable(value);
  const obj = expandable ? (value as SceneObject) : null;
  const keys = obj ? Object.keys(obj) : [];
  const hasChildren = keys.length > 0;

  useEffect(() => {
    setEditText(formatValue(value));
  }, [value]);

  const commitEdit = () => setValue(parseInput(editText));

  const pad = { paddingLeft: `${depth}rem` };
  const inputClass = `w-full min-w-0 flex-1 py-0 border-0 bg-transparent text-inherit ${textSize} font-[inherit] outline-none`;

  if (!expandable) {
    return (
      <div className={cn(rowClass, "gap-1 justify-start")} style={pad}>
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
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={cn(rowClass, "cursor-pointer", fg, hover, "outline-none gap-1 justify-between flex flex-row")}
        style={pad}
      >
        <div className="flex flex-row items-center gap-1 min-w-0 flex-1">
          <Box size={12} className="shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </div>
        <ChevronRight size={12} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
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
      <div className={cn("w-full p-3 flex items-center", textSize, font, muted)}>
        {!rootObj ? "No scene data" : "Scene is empty"}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 py-2">
      {Object.keys(rootObj).map((k) => (
        <TreeNode name={k} depth={0} path={[]} key={k} />
      ))}
    </div>
  );
}
