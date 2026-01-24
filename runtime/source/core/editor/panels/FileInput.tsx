import { useState, useRef, useCallback, useEffect } from "react";
import { listFiles } from "../../fileUtilities";
import { X } from "@phosphor-icons/react";

interface FileInputProps {
  value: string;
  onChange: (value: string) => void;
  accept?: string; // e.g., "image/*", ".png,.svg"
  placeholder?: string;
  directory?: string; // Optional directory prop (currently unused but kept for compatibility)
}

export function FileInput({
  value,
  onChange,
  accept,
  placeholder = "Select file...",
}: FileInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load available assets from assets folder
  useEffect(() => {
  const loadAssets = async () => {
  try {
    const files = await listFiles("assets");
    const assetNames = new Set(files.map(([name]) => name));
    setAvailableAssets(assetNames);
  } catch (error) {
    console.error("Failed to load assets:", error);
    // If we can't load assets, allow all files (fallback)
  }
  };
  loadAssets();
  }, []);

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

  const validateAndSetFile = useCallback(
  (fileName: string) => {
  // Check if file exists in assets folder
  if (availableAssets.size > 0 && !availableAssets.has(fileName)) {
    setError(`File "${fileName}" is not in the assets folder`);
    return false;
  }
  setError("");
  onChange(fileName);
  return true;
  },
  [availableAssets, onChange]
  );

  const handleDrop = useCallback(
  (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    const file = files[0];
    const fileName = file.name;
    validateAndSetFile(fileName);
  }
  },
  [validateAndSetFile]
  );

  const handleBrowseClick = () => {
  fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files && files.length > 0) {
  const fileName = files[0].name;
  validateAndSetFile(fileName);
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
    // Clicking opens file dialog directly - no dropdown
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
    border: error
      ? "1px solid #f48771"
      : isDragging
      ? "1px dashed #4ec9b0"
      : "1px solid transparent",
    borderRadius: "2px",
    backgroundColor: isDragging ? "rgba(78, 201, 176, 0.1)" : "transparent",
    }}
  >
    <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
    {displayValue}
    </span>
    {isValueSet && (
    <X
      size={10}
      weight="bold"
      onClick={(e) => {
      e.stopPropagation();
      setError("");
      onChange("");
      }}
      style={{
      marginLeft: "4px",
      marginRight: "2px",
      cursor: "pointer",
      color: "#808080",
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
  {error && (
    <div
    style={{
      fontSize: "11px",
      color: "#f48771",
      marginTop: "2px",
      paddingLeft: "2px",
    }}
    >
    {error}
    </div>
  )}
  </div>
  );
}

