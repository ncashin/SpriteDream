import { Check } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSuggestions } from "../hooks/useCatalog.js";
import { cn } from "../../utils/cn.js";
import { fuzzyFilter } from "../../utils/fuzzyMatch.js";
import { Dropdown } from "./Dropdown.js";

const HEX_COLOR_RE = /^#?([0-9a-f]{6})$/i;
const BOOLEAN_RE = /^(true|false)$/i;
const NUMBER_RE = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseHexColor(value: string): string | null {
  const match = HEX_COLOR_RE.exec(value.trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

function parsePropertyValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const lower = trimmed.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  const hex = parseHexColor(trimmed);
  if (hex) return hex;
  if (NUMBER_RE.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function isBooleanText(text: string): boolean {
  return BOOLEAN_RE.test(text.trim());
}

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
  const hexColor = parseHexColor(text);

  const filteredSuggestions = useMemo(
    () => fuzzyFilter(text, suggestions),
    [text, suggestions],
  );

  const commitEdit = () => {
    setValue(parsePropertyValue(text));
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

  const colorSwatch = hexColor ? (
    <input
      type="color"
      value={hexColor}
      aria-label="Pick color"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        setValue(event.target.value);
        setDraft(null);
      }}
      className={cn(
        "size-4 shrink-0 cursor-pointer border border-[var(--color-border)] p-0",
        "bg-transparent [&::-webkit-color-swatch-wrapper]:p-0",
        "[&::-webkit-color-swatch]:border-0",
        "[&::-moz-color-swatch]:border-0",
      )}
    />
  ) : null;

  const showBooleanToggle =
    typeof value === "boolean" || isBooleanText(text);
  const boolValue =
    draft !== null && isBooleanText(text)
      ? text.trim().toLowerCase() === "true"
      : typeof value === "boolean"
        ? value
        : false;

  const booleanToggle = showBooleanToggle ? (
    <button
      type="button"
      role="checkbox"
      aria-checked={boolValue}
      aria-label={boolValue ? "Set false" : "Set true"}
      onClick={(event) => {
        event.stopPropagation();
        setValue(!boolValue);
        setDraft(null);
      }}
      className={cn(
        "flex size-4 shrink-0 cursor-pointer items-center justify-center border border-[var(--color-border)] p-0",
        boolValue
          ? "bg-[var(--color-highlight)] text-[var(--color-on-accent)]"
          : "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]",
      )}
    >
      {boolValue ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
    </button>
  ) : null;

  const field = (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {input}
      {colorSwatch}
      {booleanToggle}
    </div>
  );

  if (suggestions.length === 0) return field;

  return (
    <Dropdown
      open={open && filteredSuggestions.length > 0}
      onOpenChange={setOpen}
      showSearch={false}
      options={filteredSuggestions.map((s) => ({ value: s, label: s }))}
      value={displayValue}
      onChange={(suggestion) => {
        skipCommitOnBlurRef.current = true;
        setValue(parsePropertyValue(suggestion));
        setDraft(null);
        setOpen(false);
      }}
      className="flex min-w-0 flex-1"
    >
      {field}
    </Dropdown>
  );
}
