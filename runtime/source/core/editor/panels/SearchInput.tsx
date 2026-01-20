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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow standard shortcuts like Cmd+A / Ctrl+A to work
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      // Don't prevent default - allow select all to work
      return;
    }

    // Call the custom onKeyDown handler if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className="relative flex items-center min-w-0 w-full">
      <span
        className="codicon codicon-search absolute left-2 pointer-events-none z-[1] text-white/60"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className="flex-1 w-full py-0.5 pr-3 pl-6 text-xs bg-gray-500/30 text-white/90 border-none rounded-sm outline-none min-w-0 min-h-5 box-border focus:outline focus:outline-1 focus:outline-[#007acc] focus:-outline-offset-1"
        style={{
          fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
        }}
      />
    </div>
  );
}

