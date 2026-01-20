import { useEditorContext, useSelectedEntity, useSceneEntities } from "../EditorContext";
import { EntityModal } from "./EntityModal";

export function EntityModalContainer() {
  const ecsContext = useEditorContext();
  const selectedEntity = useSelectedEntity();
  const entities = useSceneEntities();

  if (!ecsContext) return null;

  // Check if entity is valid (exists in entities list)
  const isValidEntity = selectedEntity !== null && entities.includes(selectedEntity);
  const validSelectedEntity = isValidEntity ? selectedEntity : null;

  return (
    <EntityModal
      isOpen={validSelectedEntity !== null}
      entity={validSelectedEntity}
      onClose={() => ecsContext.ecs.clearSelection()}
    />
  );
}

