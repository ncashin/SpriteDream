import cn from "cnfast";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Popover({
  trigger,
  children,
  className,
  contentClassName,
}: {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full mt-2 z-50 rounded-md border border-border bg-background shadow-lg",
            contentClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
