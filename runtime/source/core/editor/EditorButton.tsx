import React, { useState, forwardRef } from 'react';
import { cn } from '../utils';

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
        className={cn(
          'px-3 py-0.5 text-[0.75rem] font-normal rounded-sm border-none cursor-pointer duration-100 ease-out inline-flex items-center justify-center min-h-[20px] leading-[1.4em] outline-none focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder,#007acc)] focus:-outline-offset-1',
          'text-[var(--vscode-button-foreground,rgba(255,255,255,0.9))]',
          'font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)]',
          isPressed
            ? 'bg-[rgba(128,128,128,0.4)]'
            : isHovered
            ? 'bg-[rgba(128,128,128,0.35)]'
            : 'bg-[rgba(128,128,128,0.3)]'
        )}
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

