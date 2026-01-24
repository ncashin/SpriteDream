import { useState, useEffect } from "react";
import {
    isGameUIVisible,
    isEditorUIVisible,
    setGameUIVisible,
    setEditorUIVisible,
    subscribeToVisibilityChanges,
} from "./uiVisibility.ts";

export function UIVisibilityToggle() {
    const [gameUIVisible, setGameUIVisibleState] = useState(isGameUIVisible());
    const [editorUIVisible, setEditorUIVisibleState] = useState(isEditorUIVisible());

    useEffect(() => {
        const unsubscribe = subscribeToVisibilityChanges(() => {
            setGameUIVisibleState(isGameUIVisible());
            setEditorUIVisibleState(isEditorUIVisible());
        });
        return unsubscribe;
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                bottom: "8px",
                right: "8px",
                display: "flex",
                gap: "4px",
                zIndex: 10001,
                pointerEvents: "auto",
            }}
        >
            <button
                className="px-3 py-0.5 text-[0.75rem] font-normal rounded-sm border-none cursor-pointer duration-100 ease-out inline-flex items-center justify-center gap-1 min-h-[20px] leading-[1.4em] outline-none focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder,#007acc)] focus:-outline-offset-1"
                style={{
                    fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
                    color: 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))',
                    backgroundColor: 'var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.3))',
                    pointerEvents: "auto",
                    zIndex: 10001,
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
                onClick={() => setGameUIVisible(!gameUIVisible)}
            >
                {gameUIVisible ? "Hide Game UI" : "Show Game UI"}
            </button>
            <button
                className="px-3 py-0.5 text-[0.75rem] font-normal rounded-sm border-none cursor-pointer duration-100 ease-out inline-flex items-center justify-center gap-1 min-h-[20px] leading-[1.4em] outline-none focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder,#007acc)] focus:-outline-offset-1"
                style={{
                    fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
                    color: 'var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))',
                    backgroundColor: 'var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.3))',
                    pointerEvents: "auto",
                    zIndex: 10001,
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
                onClick={() => setEditorUIVisible(!editorUIVisible)}
            >
                {editorUIVisible ? "Hide Editor UI" : "Show Editor UI"}
            </button>
        </div>
    );
}

