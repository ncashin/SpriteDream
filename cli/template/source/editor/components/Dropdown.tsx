import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";
import { fuzzyScore } from "../../utils/fuzzyMatch.js";
import { IconButton } from "./IconButton.js";

const stopMousePropagation = (event: ReactMouseEvent) => {
  event.stopPropagation();
};

const itemClassName = cn(
  "flex w-full min-w-0 items-center py-1 pl-1.5 pr-1.5 text-left text-xs",
  "font-[var(--vscode-font-family)] cursor-pointer border-0 text-[var(--color-text)]",
  "bg-transparent hover:bg-[var(--color-hover)]",
);

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

export function Dropdown({
  open,
  onOpenChange,
  options,
  value,
  onChange,
  className,
  children,
  showSearch = true,
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const highlightedIndexRef = useRef(0);
  highlightedIndexRef.current = highlightedIndex;

  const filteredOptions = useMemo(() => {
    if (!showSearch) return options;
    const normalized = query.trim();
    if (!normalized) return options;
    return options
      .map((option) => ({ option, score: fuzzyScore(normalized, option.label) }))
      .filter(
        (entry): entry is { option: DropdownOption; score: number } =>
          entry.score != null,
      )
      .sort(
        (a, b) =>
          b.score - a.score || a.option.label.localeCompare(b.option.label),
      )
      .map((entry) => entry.option);
  }, [options, query, showSearch]);

  const selectOption = useCallback(
    (option: DropdownOption) => {
      onChange(option.value);
      onOpenChange(false);
    },
    [onChange, onOpenChange],
  );

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 2,
      left: rect.left,
      minWidth: rect.width,
      zIndex: 2147483647,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    setHighlightedIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }

      const count = filteredOptions.length;
      if (count === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setHighlightedIndex((index) => Math.min(index + 1, count - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const option = filteredOptions[highlightedIndexRef.current];
        if (option) selectOption(option);
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onOpenChange, filteredOptions, selectOption]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      onMouseDown={stopMousePropagation}
      onMouseUp={stopMousePropagation}
      onClick={stopMousePropagation}
      className={cn(
        showSearch ? "flex flex-col overflow-hidden" : "overflow-hidden",
        "border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)]",
        "bg-[var(--color-bg)] shadow-[0_4px_16px_var(--color-shadow)]",
      )}
    >
      {showSearch ? (
        <div className="flex items-center gap-1 border-b border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] pl-1.5 pr-1 py-1">
          <Search
            size={14}
            aria-hidden
            className="shrink-0 text-white"
          />
          <input
            ref={searchRef}
            autoFocus
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightedIndex(0);
            }}
            onMouseDown={stopMousePropagation}
            onClick={stopMousePropagation}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent py-0.5 text-xs outline-none",
              "text-[var(--color-text)] placeholder:text-[var(--color-muted)]",
              "font-[var(--vscode-font-family)]",
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {query && (
            <IconButton
              aria-label="Clear search"
              onMouseDown={stopMousePropagation}
              onClick={(event) => {
                event.stopPropagation();
                setQuery("");
                setHighlightedIndex(0);
                searchRef.current?.focus();
              }}
            >
              <X size={14} aria-hidden />
            </IconButton>
          )}
        </div>
      ) : null}
      <div className="max-h-56 overflow-auto p-1">
        {filteredOptions.length === 0 ? (
          showSearch ? (
            <div className="py-1 pl-1.5 pr-1.5 text-xs text-[var(--color-muted)]">
              {emptyMessage}
            </div>
          ) : null
        ) : (
          filteredOptions.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={option.value}
                type="button"
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectOption(option);
                }}
                className={cn(
                  itemClassName,
                  isHighlighted && "bg-[var(--color-hover)]",
                  isSelected && "bg-[var(--color-selection)] font-medium",
                  isHighlighted && isSelected && "font-medium",
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      onMouseDown={stopMousePropagation}
      onMouseUp={stopMousePropagation}
      onClick={stopMousePropagation}
      className={cn("relative min-w-0 shrink-0", className)}
    >
      {children}
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
