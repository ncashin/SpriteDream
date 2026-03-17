import { useRef } from "react";
import { cn } from "../utils/cn.js";

type OverlayInputProps = {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  className?: string;
};

export function OverlayInput({
  value,
  placeholder,
  onChange,
  className,
}: OverlayInputProps) {
  const displayText =
    typeof value === "string" && value.length > 0
      ? value
      : placeholder ?? "";
  const measureRef = useRef<HTMLSpanElement | null>(null);

  return (
    <div
      className={cn(
        "relative inline-flex items-stretch justify-center",
        className,
      )}
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className="py-0.5 px-1.5 text-xs font-[var(--vscode-font-family)] whitespace-pre invisible"
      >
        {displayText || " "}
      </span>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "absolute inset-0 py-0.5 px-1.5 text-xs text-[var(--vscode-editor-foreground)]",
          "bg-[var(--vscode-editor-background)]/80 hover:bg-[var(--vscode-editor-background)]",
          "border-none rounded outline-none font-[var(--vscode-font-family)]",
          "truncate",
        )}
      />
    </div>
  );
}

