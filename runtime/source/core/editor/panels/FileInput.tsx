import { useState, useRef, useCallback } from "react";

interface FileInputProps {
  value: string;
  onChange: (value: string) => void;
  accept?: string; // e.g., "image/*", ".png,.svg"
  placeholder?: string;
}

export function FileInput({
  value,
  onChange,
  accept,
  placeholder = "Select file...",
}: FileInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];
        // Extract just the filename
        const fileName = file.name;
        // Update value with relative path from assets directory
        onChange(fileName);
      }
    },
    [onChange]
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileName = files[0].name;
      onChange(fileName);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayValue = value || placeholder;
  const isValueSet = !!value;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />
      <div
        onClick={(e) => {
          e.stopPropagation();
          // Clicking the input opens file dialog directly
          handleBrowseClick();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          padding: 0,
          margin: 0,
          color: isValueSet ? "#ce9178" : "#808080",
          fontSize: "inherit",
          width: "100%",
          border: isDragging ? "1px dashed #4ec9b0" : "1px solid transparent",
          borderRadius: "2px",
          backgroundColor: isDragging ? "rgba(78, 201, 176, 0.1)" : "transparent",
        }}
      >
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayValue}
        </span>
        {isValueSet && (
          <span
            className="codicon codicon-close"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            style={{
              fontSize: "10px",
              color: "#808080",
              marginLeft: "4px",
              marginRight: "2px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f48771";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#808080";
            }}
          />
        )}
      </div>
    </div>
  );
}

