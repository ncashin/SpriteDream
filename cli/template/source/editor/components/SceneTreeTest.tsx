import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useScene } from "gameide";
import DynamicIcon from "./DynamicIcon.js";
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
    else if (typeof value === "boolean") setValue(text === "true");
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
      className="min-w-0 flex-1 border-0 bg-transparent py-0.5  text-[var(--color-text)] outline-none font-[inherit]"
    />
  );
}

function TreeNode({
  path,
  defaultExpanded = true,
}: {
  path: PropertyKey[];
  defaultExpanded?: boolean;
}) {
  const [value, setValue] = useScene(path);
  const [expanded, setExpanded] = useState(defaultExpanded);
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
          "group flex items-center gap-1 px-2 py-1  text-[var(--color-text)] hover:bg-[var(--color-hover)]",
          isObject && "cursor-pointer",
        )}
        onClick={isObject ? () => setExpanded((open) => !open) : undefined}
      >
        {isObject ? (
          <>
            <DynamicIcon name={iconKey} className="shrink-0 text-white" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <ChevronRight
              size={14}
              className={cn(
                "shrink-0 text-white transition-[opacity,transform] duration-150 ease-out",
                "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
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
              defaultExpanded={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SceneTreeTest() {
  const [root] = useScene([]);

  return (
    <div className="flex-1 min-h-0 overflow-auto text-xs">
      {Object.keys(root ?? {}).map((key) => (
        <TreeNode key={key} path={[key]} defaultExpanded={false} />
      ))}
    </div>
  );
}
