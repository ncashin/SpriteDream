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
    <div className="relative flex items-center min-w-0 w-full">
      <span
        className="codicon codicon-search absolute left-2 pointer-events-none z-[1] text-xs text-white/60"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className="flex-1 w-full py-0.5 pr-3 pl-6 text-xs bg-gray-500/30 text-white/90 border-none rounded-sm outline-none min-w-0 min-h-5 box-border focus:outline focus:outline-1 focus:outline-[#007acc] focus:-outline-offset-1"
        style={{
          fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
        }}
      />
    </div>
  );
}

