import { ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../../utils/cn.js";

export type SearchDropdownOption = {
  value: string;
  label: string;
  group?: string;
};

type SearchDropdownProps = {
  options: SearchDropdownOption[];
  onSelect: (value: string) => void;
  value?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  variant?: "header" | "icon";
  icon?: ReactNode;
  title?: string;
  emptyMessage?: string;
};

function groupOptions(options: SearchDropdownOption[]): Map<string, SearchDropdownOption[]> {
  const groups = new Map<string, SearchDropdownOption[]>();
  for (const option of options) {
    const group = option.group ?? "";
    const bucket = groups.get(group);
    if (bucket) bucket.push(option);
    else groups.set(group, [option]);
  }
  return groups;
}

export function SearchDropdown({
  options,
  onSelect,
  value,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  ariaLabel,
  disabled = false,
  className,
  triggerClassName,
  variant = "header",
  icon,
  title,
  emptyMessage = "No matches",
}: SearchDropdownProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.group ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);

  const grouped = useMemo(() => groupOptions(filtered), [filtered]);

  const flatFiltered = useMemo(() => {
    const flat: SearchDropdownOption[] = [];
    for (const [, items] of grouped) flat.push(...items);
    return flat;
  }, [grouped]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const choose = useCallback(
    (nextValue: string) => {
      onSelect(nextValue);
      close();
    },
    [close, onSelect],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= flatFiltered.length) {
      setActiveIndex(Math.max(0, flatFiltered.length - 1));
    }
  }, [activeIndex, flatFiltered.length]);

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(flatFiltered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && flatFiltered[activeIndex]) {
      event.preventDefault();
      choose(flatFiltered[activeIndex].value);
    }
  }

  const triggerLabel = selected?.label ?? placeholder;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        title={title ?? (variant === "header" ? triggerLabel : title)}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={cn(
          "flex min-w-0 items-center gap-0.5 border-0 bg-transparent p-0 text-left outline-none",
          "font-[var(--vscode-font-family)] cursor-pointer disabled:cursor-default disabled:opacity-45",
          variant === "header" &&
            cn(
              "h-[22px] min-h-[22px] max-w-full rounded px-0.5 -mx-0.5",
              "text-xs font-semibold text-[var(--vscode-editor-foreground)]",
              "hover:bg-[var(--vscode-list-hoverBackground)]",
              "focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]",
              open && "bg-[var(--vscode-list-hoverBackground)]",
            ),
          variant === "icon" &&
            cn(
              "relative flex items-center justify-center self-center rounded p-0.5",
              "opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]",
              open && "opacity-100 bg-[var(--vscode-list-hoverBackground)]",
            ),
          triggerClassName,
        )}
      >
        {variant === "icon" ? (
          icon
        ) : (
          <>
            <span className="min-w-0 truncate">{triggerLabel}</span>
            <ChevronDown
              size={14}
              aria-hidden
              className={cn(
                "shrink-0 text-[var(--vscode-descriptionForeground)] transition-transform",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute left-0 z-50 mt-1 flex min-w-[220px] max-w-[min(100vw-1rem,320px)] flex-col overflow-hidden rounded",
            "border border-[color-mix(in_srgb,var(--vscode-widget-border)_80%,transparent)]",
            "bg-[var(--vscode-editor-background)] shadow-[0_4px_16px_rgba(0,0,0,0.28)]",
            variant === "icon" ? "right-0 left-auto" : "w-full max-w-none",
          )}
        >
          <div className="flex items-center gap-1.5 border-b border-[color-mix(in_srgb,var(--vscode-widget-border)_60%,transparent)] px-2 py-1.5">
            <Search
              size={14}
              aria-hidden
              className="shrink-0 text-[var(--vscode-descriptionForeground)]"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              className={cn(
                "min-w-0 flex-1 border-0 bg-transparent py-0.5 text-xs outline-none",
                "text-[var(--vscode-editor-foreground)] placeholder:text-[var(--vscode-descriptionForeground)]",
                "font-[var(--vscode-font-family)]",
              )}
            />
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-56 overflow-auto py-1"
          >
            {flatFiltered.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-[var(--vscode-descriptionForeground)]">
                {emptyMessage}
              </div>
            ) : (
              [...grouped.entries()].map(([group, items]) => (
                <div key={group || "__default"}>
                  {group ? (
                    <div className="px-2 pb-0.5 pt-1 text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                      {group}
                    </div>
                  ) : null}
                  {items.map((option) => {
                    const index = flatFiltered.findIndex(
                      (entry) => entry.value === option.value,
                    );
                    const active = index === activeIndex;
                    const selectedOption = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selectedOption}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(option.value)}
                        className={cn(
                          "flex w-full min-w-0 items-center px-2 py-1 text-left text-xs",
                          "font-[var(--vscode-font-family)] cursor-pointer border-0 bg-transparent",
                          active
                            ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
                            : "text-[var(--vscode-editor-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]",
                          selectedOption && !active && "font-medium",
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
