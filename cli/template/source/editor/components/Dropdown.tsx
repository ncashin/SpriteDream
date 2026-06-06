import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";

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
};

export function Dropdown({
  open,
  onOpenChange,
  options,
  value,
  onChange,
  className,
  children,
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

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

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, onOpenChange]);

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
        "overflow-hidden",
        "border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)]",
        "bg-[var(--color-bg)] shadow-[0_4px_16px_var(--color-shadow)]",
      )}
    >
      <div className="max-h-56 overflow-auto p-1">
        {options.map((option) => (
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
        ))}
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
