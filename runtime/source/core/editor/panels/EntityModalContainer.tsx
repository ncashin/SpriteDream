import { useGameContext, useSelectedEntity, useSceneEntities } from "../EditorContext";
import { EntityModal } from "./EntityModal";

export function EntityModalContainer() {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const selectedEntity = useSelectedEntity();
  const entities = useSceneEntities();

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

