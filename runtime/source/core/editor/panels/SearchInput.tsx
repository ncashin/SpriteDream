import { MagnifyingGlass } from "@phosphor-icons/react";

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
      <MagnifyingGlass
        size={14}
        weight="bold"
        className="absolute left-2 pointer-events-none z-[1]"
        style={{
          color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.6))',
        }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className="flex-1 w-full py-1.5 pr-3 pl-8 text-xs border-none outline-none min-w-0 min-h-[28px] box-border focus:outline focus:outline-1 focus:outline-[#007acc] focus:-outline-offset-1"
        style={{
          fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
          color: 'var(--vscode-foreground, #cccccc)',
          backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))',
        }}
      />
    </div>
  );
}

