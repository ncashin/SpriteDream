import { EntityListPanel } from "./panels/EntityListPanel";
import { EntityModalContainer } from "./panels/EntityModalContainer";
import { RunStopButton } from "./RunStopButton";
import { SceneDataButton } from "./SceneDataButton";

export function Editor() {
  return (
    <>
      {/* Left Panel - Entity List & Selected Entity */}
      <div className="absolute top-2 left-2 z-[10000] flex flex-col gap-2 items-start">
        <EntityListPanel />
        <EntityModalContainer />
      </div>

      {/* Right Panel - Toolbar */}
      <div className="absolute top-2 right-2 z-[10000] flex gap-2 items-center">
        <SceneDataButton />
        <RunStopButton />
      </div>
    </>
  );
}
