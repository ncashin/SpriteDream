import React, { forwardRef } from 'react';

interface EditorButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const EditorButton = forwardRef<HTMLButtonElement, EditorButtonProps>(
  ({ onClick, children }, ref) => {
    return (
      <button
        ref={ref}
        className="px-3 py-0.5 text-[0.75rem] font-normal rounded-sm border-none cursor-pointer duration-100 ease-out inline-flex items-center justify-center gap-1 min-h-[20px] leading-[1.4em] outline-none focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder,#007acc)] focus:-outline-offset-1"
        style={{
          fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          color: 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))',
          backgroundColor: 'var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.3))',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.35))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.3))';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.4))';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.35))';
        }}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
);

