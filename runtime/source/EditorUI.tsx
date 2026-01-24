import { EntityListPanel } from "./core/editor/panels/EntityListPanel";
import { EntityModalContainer } from "./core/editor/panels/EntityModalContainer";
import { RunStopButton } from "./core/editor/RunStopButton";
import { SceneDataButton } from "./core/editor/SceneDataButton";
import { UIVisibilityToggle } from "./core/editor/UIVisibilityToggle";
import { useUIVisibilityStore } from "./core/editor/uiVisibility.ts";

export function EditorUI() {
    const visible = useUIVisibilityStore((state) => state.editorUIVisible);

    return (
        <>
            <UIVisibilityToggle />
            {visible && (
                <div
                    className="flex flex-row w-full h-full justify-between p-2"
                    aria-label="Editor Layout"
                >
                    <div className="flex flex-col gap-2 items-start">
                        <EntityListPanel />
                        <EntityModalContainer />
                    </div>
                    <div className="flex gap-2 items-start">
                        <SceneDataButton />
                        <RunStopButton />
                    </div>
                </div>
            )}
        </>
    );
}

