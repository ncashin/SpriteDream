import { useGameContext } from "../useGameContext.tsx";
import { useECS, useSceneEntities, useSelectedEntity } from "../useECS.tsx";
import { EntityModal } from "./EntityModal";

export function EntityModalContainer() {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs;

  useECS();
  const entities = useSceneEntities();
  const selectedEntity = useSelectedEntity();

  if (!ecs) return null;

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

