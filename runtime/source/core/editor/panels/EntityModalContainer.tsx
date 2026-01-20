import { useEffect, useState } from "react";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import type { Entity } from "../../ecs/ecs";
import { EntityModal } from "./EntityModal";

export function EntityModalContainer() {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Sync entities from ECS
  useEffect(() => {
    if (!ecs) return;

    const updateEntities = () => {
      const allEntities = Object.keys(ecs.ecsInstance.entities);
      setEntities((prev) => {
        if (
          prev.length !== allEntities.length ||
          !prev.every((e, i) => e === allEntities[i])
        ) {
          return allEntities;
        }
        return prev;
      });
    };

    updateEntities();
    const callbackId = addDrawCallback(updateEntities);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecs]);

  // Sync selected entity from ECS
  useEffect(() => {
    if (!ecs) return;

    const updateSelection = () => {
      setSelectedEntity(ecs.getSelectedEntity() ?? null);
    };

    updateSelection();
    const callbackId = addDrawCallback(updateSelection);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecs]);

  if (!ecs) return null;

  // Check if entity is valid (exists in entities list)
  const isValidEntity = selectedEntity !== null && entities.includes(selectedEntity);
  const validSelectedEntity = isValidEntity ? selectedEntity : null;

  return (
    <EntityModal
      isOpen={validSelectedEntity !== null}
      entity={validSelectedEntity}
      onClose={() => ecs.clearSelection()}
    />
  );
}

