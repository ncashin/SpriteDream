import React, { useState, forwardRef } from 'react';

interface EditorButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const EditorButton = forwardRef<HTMLButtonElement, EditorButtonProps>(
  ({ onClick, children }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    return (
      <button
        ref={ref}
        className="px-3 py-1 text-[0.8125rem] font-normal rounded-sm border-none cursor-pointer duration-100 ease-out inline-flex items-center justify-center min-h-[22px] leading-[1.4em] outline-none focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder,#007acc)] focus:-outline-offset-1"
        style={{
          color: 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))',
          fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          backgroundColor: isPressed
            ? 'var(--vscode-button-activeBackground, rgba(255, 255, 255, 0.15))'
            : isHovered
            ? 'var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))'
            : 'transparent',
        }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
      >
        {children}
      </button>
    );
  }
);

