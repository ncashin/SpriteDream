import { useState, useRef, useEffect } from "react";
import { EditorButton } from "./EditorButton";
import {
    setEditorEnabled,
    setUpdateEnabled,
    isUpdateEnabled,
} from "../gameloop";
import {
    setPersistenceEnabled,
    saveSceneSnapshot,
    restoreSceneFromSnapshot,
} from "../scene/scene";
import { runGame } from "../runtimeWrapper";

export function RunStopButton() {
    const [isRunning, setIsRunning] = useState(isUpdateEnabled());
    const runButtonRef = useRef<HTMLButtonElement>(null);

    // Sync state with actual running state after HMR or other state changes
    useEffect(() => {
        setIsRunning(isUpdateEnabled());
        
        // Listen for HMR updates to resync state
        if (import.meta.hot) {
            const handleUpdate = () => {
                setIsRunning(isUpdateEnabled());
            };
            import.meta.hot.on("vite:afterUpdate", handleUpdate);
            return () => {
                if (import.meta.hot) {
                    import.meta.hot.off("vite:afterUpdate", handleUpdate);
                }
            };
        }
    }, []);

    const handleRunStop = async () => {
        const wasRunning = isUpdateEnabled();

        if (wasRunning) {
            await restoreSceneFromSnapshot();
            setPersistenceEnabled(true);
            setEditorEnabled(true);
            setUpdateEnabled(false);
        } else {
            saveSceneSnapshot();
            setPersistenceEnabled(false);
            setEditorEnabled(false);
            setUpdateEnabled(true);
        }

        runGame();
        setIsRunning(!wasRunning);
        runButtonRef.current?.blur();
    };

    return (
        <EditorButton ref={runButtonRef} onClick={handleRunStop}>
            {isRunning ? "Stop" : "Run"}
        </EditorButton>
    );
}

