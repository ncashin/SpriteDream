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
import { IconButton } from "./IconButton.js";

const stopMousePropagation = (event: ReactMouseEvent) => {
  event.stopPropagation();
};

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
  searchPlaceholder,
  emptyMessage = "No matches",
}: DropdownProps) {
  const searchable = searchPlaceholder != null;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalized),
    );
  }, [options, query, searchable]);

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
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !searchable) return;
    searchRef.current?.focus();
  }, [open, searchable]);

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
        searchable ? "flex flex-col overflow-hidden" : "overflow-hidden",
        "border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)]",
        "bg-[var(--color-bg)] shadow-[0_4px_16px_var(--color-shadow)]",
      )}
    >
      {searchable ? (
        <div className="flex items-center gap-1 border-b border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] pl-1.5 pr-1 py-1">
          <Search
            size={14}
            aria-hidden
            className="shrink-0 text-white"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
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
          searchable ? (
            <div className="py-1 pl-1.5 pr-1.5 text-xs text-[var(--color-muted)]">
              {emptyMessage}
            </div>
          ) : null
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(option.value);
                onOpenChange(false);
              }}
              className={cn(
                "flex w-full min-w-0 items-center py-1 pl-1.5 pr-1.5 text-left text-xs",
                "font-[var(--vscode-font-family)] cursor-pointer border-0",
                option.value === value
                  ? "bg-[var(--color-selection)] font-medium text-[var(--color-text)]"
                  : "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)]",
              )}
            >
              <span className="min-w-0 truncate">{option.label}</span>
            </button>
          ))
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
