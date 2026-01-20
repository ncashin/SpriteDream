import { EntityListPanel } from "./panels/EntityListPanel";
import { EntityModalContainer } from "./panels/EntityModalContainer";
import { EntityStateSynchronizer } from "./EditorContext";
import { RunStopButton } from "./RunStopButton";
import { SceneDataButton } from "./SceneDataButton";

export function Editor() {
  return (
    <>
      <EntityStateSynchronizer />

      {/* Left Panel - Entity List & Selected Entity */}
      <div
        style={{
          position: "absolute",
          top: "0.5rem",
          left: "0.5rem",
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          alignItems: "flex-start",
        }}
      >
        <EntityListPanel />
        <EntityModalContainer />
      </div>

      {/* Right Panel - Toolbar */}
      <div
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          zIndex: 10000,
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <SceneDataButton />
        <RunStopButton />
      </div>
    </>
  );
}
