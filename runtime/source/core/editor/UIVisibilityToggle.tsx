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
            className="text-xs leading-normal"
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
            <span
                className="clickable-text"
                onClick={() => setGameUIVisible(!gameUIVisible)}
            >
                {gameUIVisible ? "Hide Game UI" : "Show Game UI"}
            </span>
            <span
                className="clickable-text"
                onClick={() => setEditorUIVisible(!editorUIVisible)}
            >
                {editorUIVisible ? "Hide Editor UI" : "Show Editor UI"}
            </span>
        </div>
    );
}

