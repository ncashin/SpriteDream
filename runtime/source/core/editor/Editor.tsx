import { useState, useRef, useEffect } from "react";
import { EditorButton } from "./EditorButton";
import { SceneDataModal } from "./SceneDataModal";
import { EntityListPanel } from "./panels/EntityListPanel";
import { EntityModal } from "./panels/EntityModal";
import { EditorContext, type ECSContextType } from "./EditorContext";
import {
  setEditorEnabled,
  setUpdateEnabled,
  isUpdateEnabled,
  addDrawCallback,
  removeDrawCallback,
} from "../gameloop";
import {
  setPersistenceEnabled,
  saveSceneSnapshot,
  restoreSceneFromSnapshot,
} from "../scene/scene";
import { runGame } from "../runtimeWrapper";
import type { Entity } from "../ecs/ecs";

interface EditorProps {
  ecsContext: ECSContextType | null;
}

export function Editor({ ecsContext }: EditorProps) {
  const [isSceneDataModalOpen, setIsSceneDataModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const runButtonRef = useRef<HTMLButtonElement>(null);

  // Sync selected entity with ECS
  useEffect(() => {
    if (!ecsContext) return;

    const updateSelection = () => {
      const currentSelection = ecsContext.ecs.getSelectedEntity() ?? null;
      setSelectedEntity(currentSelection);
    };

    updateSelection();

    const callbackId = addDrawCallback(updateSelection);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecsContext]);

  const isValidEntity = (entity: Entity | null): boolean => {
    if (!entity || !ecsContext) return false;
    return entity in ecsContext.ecs.ecsInstance.entities;
  };

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

  const validSelectedEntity = isValidEntity(selectedEntity)
    ? selectedEntity
    : null;

  return (
    <EditorContext.Provider value={ecsContext}>
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
            <EntityModal
              isOpen={validSelectedEntity !== null}
              entity={validSelectedEntity}
              onClose={() => ecsContext.ecs.clearSelection()}
            />
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
        <EditorButton onClick={() => setIsSceneDataModalOpen(true)}>
          Scene Data
        </EditorButton>
        <EditorButton ref={runButtonRef} onClick={handleRunStop}>
          {isRunning ? "Stop" : "Run"}
        </EditorButton>
      </div>

      {/* Modals */}
      <SceneDataModal
        isOpen={isSceneDataModalOpen}
        onClose={() => setIsSceneDataModalOpen(false)}
      />
    </EditorContext.Provider>
  );
}
