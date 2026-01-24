interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorInput({
  value,
  onChange,
}: ColorInputProps) {

  // Ensure value is a valid hex color (default to #000000 if invalid)
  const normalizedValue = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty or partial hex values while typing
    if (newValue === "" || /^#[0-9A-Fa-f]{0,6}$/i.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleTextBlur = () => {
    // Validate and normalize on blur
    if (!value || !/^#[0-9A-Fa-f]{6}$/i.test(value)) {
      onChange("#000000");
    } else {
      // Normalize to uppercase
      onChange(value.toUpperCase());
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        width: "100%",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="color"
        value={normalizedValue}
        onChange={handleColorChange}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "20px",
          height: "20px",
          aspectRatio: "1",
          cursor: "pointer",
          border: "1px solid var(--vscode-input-border, #3e3e3e)",
          borderRadius: "2px",
          padding: 0,
          backgroundColor: "transparent",
          boxSizing: "border-box",
        }}
      />
      <input
        type="text"
        value={value || ""}
        onChange={handleTextChange}
        onClick={(e) => e.stopPropagation()}
        placeholder="#000000"
        style={{
          flex: 1,
          backgroundColor: "transparent",
          border: "1px solid var(--vscode-input-border, #3e3e3e)",
          borderRadius: "2px",
          color: "var(--vscode-symbolIcon-stringForeground, #ce9178)",
          fontSize: "inherit",
          padding: "2px 4px",
          outline: "none",
          fontFamily: "inherit",
          minWidth: 0,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--vscode-focusBorder, #4ec9b0)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--vscode-input-border, #3e3e3e)";
          handleTextBlur();
        }}
      />
    </div>
  );
}

