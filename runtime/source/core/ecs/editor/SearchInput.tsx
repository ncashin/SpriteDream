import React from "react";

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}

export function SearchInput({
  placeholder,
  value,
  onChange,
  onKeyDown,
  autoFocus,
}: SearchInputProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0,
        width: "100%",
      }}
    >
      <span
        className="codicon codicon-search"
        style={{
          fontSize: "0.75rem",
          color: "var(--vscode-button-foreground, rgba(255, 255, 255, 0.6))",
          position: "absolute",
          left: "0.5rem",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          width: "100%",
          padding: "0.125rem 0.75rem 0.125rem 1.5rem",
          fontSize: "0.75rem",
          fontWeight: "normal",
          backgroundColor: "rgba(128, 128, 128, 0.3)",
          color: "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
          border: "none",
          borderRadius: "2px",
          outline: "none",
          fontFamily:
            "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          minWidth: 0,
          minHeight: "20px",
          lineHeight: "1.4em",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline =
            "1px solid var(--vscode-focusBorder, #007acc)";
          e.currentTarget.style.outlineOffset = "-1px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      />
    </div>
  );
}
