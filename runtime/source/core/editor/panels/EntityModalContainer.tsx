import { useGameContext } from "../useGameContext.tsx";
import { useECS, useSceneEntities, useSelectedEntity } from "../useECS.tsx";
import type { curryECSInstance } from "../../ecs/ecs";
import { EntityModal } from "./EntityModal";

export function EntityModalContainer() {
  const gameContext = useGameContext();
  const ecs = (gameContext?.ecs as ReturnType<typeof curryECSInstance> | undefined);

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

