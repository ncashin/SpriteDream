import { useState, useRef } from "react";
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
            {isRunning ? (
                <>
                    <span className="codicon codicon-debug-stop" />
                    Stop
                </>
            ) : (
                <>
                    <span className="codicon codicon-debug-start" />
                    Run
                </>
            )}
        </EditorButton>
    );
}

