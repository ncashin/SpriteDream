import { Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const maxWidth = Math.min(window.innerWidth - 16, 320);
    const minWidth = 220;

    if (variant === "icon") {
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        minWidth,
        maxWidth,
        zIndex: 2147483647,
      });
      return;
    }

    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      minWidth,
      zIndex: 2147483647,
    });
  }, [variant]);

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
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      close();
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

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const selectedIndex = flatFiltered.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, flatFiltered, value]);

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

  const triggerLabel =
    selected?.label ?? (value && value.length > 0 ? value : placeholder);

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className={cn(
        "flex flex-col overflow-hidden rounded",
        "border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)]",
        "bg-[var(--color-bg)] shadow-[0_4px_16px_var(--color-shadow)]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 border-b border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] py-1",
          variant === "header" ? "px-2.5" : "px-1.5",
        )}
      >
        <Search
          size={14}
          aria-hidden
          className="shrink-0 text-[var(--color-muted)]"
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
            "text-[var(--color-fg)] placeholder:text-[var(--color-muted)]",
            "font-[var(--vscode-font-family)]",
          )}
        />
      </div>

      <div
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className={cn(
          "max-h-56 overflow-auto py-1",
          variant === "header" ? "px-2.5" : "px-1.5",
        )}
      >
        {flatFiltered.length === 0 ? (
          <div
            className={cn(
              "py-1 text-xs text-[var(--color-muted)]",
              variant === "header" ? "px-2.5" : "px-1.5",
            )}
          >
            {emptyMessage}
          </div>
        ) : (
          [...grouped.entries()].map(([group, items]) => (
            <div key={group || "__default"}>
              {group ? (
                <div
                  className={cn(
                    "pb-0.5 pt-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]",
                    variant === "header" ? "px-2.5" : "px-1.5",
                  )}
                >
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
                      "flex w-full min-w-0 items-center rounded py-1 text-left text-xs",
                      variant === "header" ? "pl-2.5 pr-2.5" : "pl-1.5 pr-1.5",
                      "font-[var(--vscode-font-family)] cursor-pointer border-0",
                      selectedOption
                        ? "bg-[var(--color-selection)] font-medium text-[var(--color-fg)]"
                        : active
                          ? "bg-[var(--color-hover)] text-[var(--color-fg)]"
                          : "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-hover)]",
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

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
              "h-[26px] min-h-[26px] w-full max-w-full items-center gap-0.5 rounded pl-2.5 pr-2.5",
              "text-sm font-semibold leading-none text-[var(--color-fg)]",
              "hover:bg-[var(--color-hover)]",
              "focus-visible:ring-1 focus-visible:ring-[var(--color-highlight)]",
              open && "bg-[var(--color-hover)]",
            ),
          variant === "icon" &&
            cn(
              "relative flex items-center justify-center self-center rounded p-0.5",
              "opacity-70 hover:opacity-100 hover:bg-[var(--color-hover)]",
              open && "opacity-100 bg-[var(--color-hover)]",
            ),
          triggerClassName,
        )}
      >
        {variant === "icon" ? (
          icon
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">
            {triggerLabel}
          </span>
        )}
      </button>

      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
