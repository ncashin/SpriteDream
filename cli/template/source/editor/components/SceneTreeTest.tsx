import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useScene, useTraits } from "gameide";
import DynamicIcon from "./DynamicIcon.js";
import { Dropdown } from "./Dropdown.js";
import { IconButton } from "./IconButton.js";
import { cn } from "../../utils/cn.js";

function PropertyInput({
  value,
  setValue,
}: {
  value: unknown;
  setValue: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const skipCommitOnBlurRef = useRef(false);
  const text =
    draft ?? String(value ?? "")

  const commitEdit = () => {
    if (typeof value === "number") setValue(Number(text));
    else setValue(text);
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
    <input
      type="text"
      value={text}
      onFocus={() =>
        setDraft(typeof value === "string" ? value : String(value ?? ""))
      }
      onChange={(e) => setDraft(e.target.value)}
      onBlur={endEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          skipCommitOnBlurRef.current = true;
          e.currentTarget.blur();
        }
      }}
      className="min-w-0 flex-1 border-0 bg-transparent text-[var(--color-text)] outline-none font-[inherit]"
    />
  );
}

function TreeNode({
  path,
  depth = 0,
  defaultExpanded = true,
}: {
  path: PropertyKey[];
  depth?: number;
  defaultExpanded?: boolean;
}) {
  const { value, setValue, deleteValue } = useScene(path);
  const { traits, mergeTraitInto } = useTraits();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [addOpen, setAddOpen] = useState(false);
  const name = String(path[path.length - 1] ?? "Scene");
  const isObject = value !== null && typeof value === "object";
  const iconKey =
    isObject && "__icon" in value && typeof value.__icon === "string"
      ? value.__icon
      : null;
  const childKeys = isObject
    ? Object.keys(value).filter((key) => key !== "__icon")
    : [];

  return (
    <div>
      <div
        className={cn(
          "sticky bg-[var(--color-bg)] group flex items-center gap-1 px-2 py-1 text-[var(--color-text)]",
          "hover:bg-[var(--color-hover)] focus-within:bg-[var(--color-hover)]",
          addOpen && "bg-[var(--color-hover)]",
          isObject && "cursor-pointer",
        )}
        style={{
          top: `calc(${depth} * (1lh + 0.5rem))`,
          zIndex: 100 - depth,
        }}
        onClick={isObject ? () => setExpanded((open) => !open) : undefined}
      >
        {isObject ? (
          <>
            <DynamicIcon name={iconKey} className="shrink-0 text-white" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <div
              className={cn(
                "flex flex-row opacity-0 pointer-events-none",
                "group-hover:opacity-100 group-hover:pointer-events-auto",
                "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
                addOpen && "opacity-100 pointer-events-auto",
              )}
            >
            <Dropdown
              open={addOpen}
              onOpenChange={setAddOpen}
              options={traits.map((t) => ({
                value: String(t.id),
                label: t.label,
              }))}
              onChange={(id: string) => mergeTraitInto(path, Number(id))}
            >
              <IconButton
                aria-label="Add trait"
                aria-expanded={addOpen}
                disabled={traits.length === 0}
                className={cn(
                  addOpen &&
                    "bg-[var(--color-hover)] hover:bg-[var(--color-hover)]",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (traits.length > 0) setAddOpen((o) => !o);
                }}
              >
                <Plus size={14} className="text-white" aria-hidden />
              </IconButton>
            </Dropdown>
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
              aria-label={expanded ? "Collapse" : "Expand"}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((open) => !open);
              }}
            >
              <ChevronRight
                size={14}
                className={cn(
                  "text-white transition-transform duration-150 ease-out",
                  expanded && "rotate-90",
                )}
                aria-hidden
              />
            </IconButton>
            </div>
          </>
        ) : (
          <>
            <span className="shrink-0 text-[var(--color-muted)]">{name}</span>
            <PropertyInput value={value} setValue={setValue} />
          </>
        )}
      </div>
      {expanded && childKeys.length > 0 && (
        <div className="pl-3.5">
          {childKeys.map((key) => (
            <TreeNode
              key={String(key)}
              path={[...path, key]}
              depth={depth + 1}
              defaultExpanded={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SceneTreeTest() {
  const { value: root } = useScene([]);

  return (
    <div className="relative isolate flex-1 min-h-0 overflow-auto text-xs">
      {Object.keys(root ?? {}).map((key) => (
        <TreeNode key={key} path={[key]} defaultExpanded={false} />
      ))}
    </div>
  );
}
