import { useMemo, useRef, useState } from "react";
import { useSuggestions } from "../hooks/useCatalog.js";
import { cn } from "../../utils/cn.js";
import { fuzzyFilter } from "../../utils/fuzzyMatch.js";
import { Dropdown } from "./Dropdown.js";

type PropertyInputProps = {
  value: unknown;
  setValue: (value: unknown) => void;
  suggestions?: readonly string[];
  className?: string;
};

export function PropertyInput({
  value,
  setValue,
  suggestions: suggestionsProp,
  className,
}: PropertyInputProps) {
  const catalogSuggestions = useSuggestions();
  const suggestions = suggestionsProp ?? catalogSuggestions;
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const skipCommitOnBlurRef = useRef(false);
  const text = draft ?? String(value ?? "");
  const displayValue = typeof value === "string" ? value : String(value ?? "");

  const filteredSuggestions = useMemo(
    () => fuzzyFilter(text, suggestions),
    [text, suggestions],
  );

  const commitEdit = () => {
    if (typeof value === "number") setValue(Number(text));
    else setValue(text);
    setDraft(null);
  };

  const endEdit = () => {
    setOpen(false);
    if (skipCommitOnBlurRef.current) {
      skipCommitOnBlurRef.current = false;
      setDraft(null);
      return;
    }
    commitEdit();
  };

  const input = (
    <input
      type="text"
      value={text}
      onFocus={() => {
        setDraft(typeof value === "string" ? value : String(value ?? ""));
        if (suggestions.length > 0) setOpen(true);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        if (suggestions.length > 0) setOpen(true);
      }}
      onBlur={endEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          skipCommitOnBlurRef.current = true;
          setOpen(false);
          event.currentTarget.blur();
        }
      }}
      className={cn(
        "min-w-0 flex-1 border-0 bg-transparent text-[var(--color-text)] outline-none font-[inherit]",
        className,
      )}
    />
  );

  if (suggestions.length === 0) return input;

  return (
    <Dropdown
      open={open && filteredSuggestions.length > 0}
      onOpenChange={setOpen}
      showSearch={false}
      options={filteredSuggestions.map((s) => ({ value: s, label: s }))}
      value={displayValue}
      onChange={(suggestion) => {
        skipCommitOnBlurRef.current = true;
        if (typeof value === "number") setValue(Number(suggestion));
        else setValue(suggestion);
        setDraft(null);
        setOpen(false);
      }}
      className="flex min-w-0 flex-1"
    >
      {input}
    </Dropdown>
  );
}
