import { useUIVisibilityStore } from "./uiVisibility.ts";

export function UIVisibilityToggle() {
    const gameUIVisible = useUIVisibilityStore((state) => state.gameUIVisible);
    const editorUIVisible = useUIVisibilityStore((state) => state.editorUIVisible);
    const setGameUIVisible = useUIVisibilityStore((state) => state.setGameUIVisible);
    const setEditorUIVisible = useUIVisibilityStore((state) => state.setEditorUIVisible);

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

