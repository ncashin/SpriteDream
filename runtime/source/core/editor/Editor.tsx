import { EntityListPanel } from "./panels/EntityListPanel";
import { EntityModalContainer } from "./panels/EntityModalContainer";
import { ECSContextInitializer, type ECSContextType } from "./EditorContext";
import { RunStopButton } from "./RunStopButton";
import { SceneDataButton } from "./SceneDataButton";

interface EditorProps {
  ecsContext: ECSContextType | null;
}

export function Editor({ ecsContext }: EditorProps) {
  return (
    <>
      <ECSContextInitializer ecsContext={ecsContext} />

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
        {ecsContext && (
          <>
            <EntityListPanel />
            <EntityModalContainer />
          </>
        )}
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
