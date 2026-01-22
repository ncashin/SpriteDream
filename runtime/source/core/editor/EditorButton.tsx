import React, { forwardRef } from 'react';

interface EditorButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const EditorButton = forwardRef<HTMLButtonElement, EditorButtonProps>(
  ({ onClick, children, disabled = false, className = "" }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`px-3 py-0.5 text-[0.75rem] font-normal rounded-sm border-none cursor-pointer duration-100 ease-out inline-flex items-center justify-center gap-1 min-h-[20px] leading-[1.4em] outline-none focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder,#007acc)] focus:-outline-offset-1 disabled:cursor-not-allowed disabled:hover:cursor-not-allowed disabled:opacity-50 ${className}`}
        style={{
          fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          color: 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))',
          backgroundColor: 'var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.3))',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.35))';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.3))';
        }}
        onMouseDown={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.4))';
          }
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.35))';
        }}
        onClick={disabled ? undefined : onClick}
      >
        {children}
      </button>
    );
  }
);

