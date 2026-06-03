import { useRef, useState } from "react";
import { useScene } from "gameide";
import DynamicIcon from "./DynamicIcon.js";

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
    draft ?? (typeof value === "string" ? value : String(value ?? ""));

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
      className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-[var(--color-text)] outline-none font-[inherit]"
    />
  );
}

function TreeNode({ path }: { path: PropertyKey[] }) {
  const [value, setValue] = useScene(path);
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
      <div className="flex items-center gap-1 px-2 py-1 text-sm text-[var(--color-text)] hover:bg-[var(--color-hover)]">
        {isObject ? (
          <>
            <DynamicIcon name={iconKey} className="shrink-0 text-white" />
            {name}
          </>
        ) : (
          <>
            <span className="shrink-0 text-[var(--color-muted)]">{name}</span>
            <PropertyInput value={value} setValue={setValue} />
          </>
        )}
      </div>
      {childKeys.length > 0 && (
        <div className="pl-3">
          {childKeys.map((key) => (
            <TreeNode key={String(key)} path={[...path, key]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SceneTreeTest() {
  const [root] = useScene([]);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {Object.keys(root ?? {}).map((key) => (
        <TreeNode key={key} path={[key]} />
      ))}
    </div>
  );
}
