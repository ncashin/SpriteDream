import { useCallback, useMemo } from "react";
import { useScene } from "../scene/SceneProvider.js";
import { getValueAtPath } from "../scene/path.js";
import { getTraitDefinitions, TraitDefinitionEntry } from "../trait/trait.js";

function cloneDefaultValue<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  return structuredClone(value);
}

function mergeMissing(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;

    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = cloneDefaultValue(value);
      continue;
    }

    const existing = target[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      mergeMissing(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    }
  }
}

export function useTraits() {
  const scene = useScene();
  const traits = useMemo(
    () =>
      getTraitDefinitions().map((definition: TraitDefinitionEntry, index: number) => ({
        id: index,
        label: definition.name,
        schema: definition.schema,
        defaults: definition.defaults,
      })),
    [],
  );

  const mergeTraitInto = useCallback(
    (objectPath: PropertyKey[], traitId: number) => {
      const traitDefinition = traits.find((trait) => trait.id === traitId);
      if (!traitDefinition) return;

      const sceneNode = getValueAtPath(
        scene.get() as Record<PropertyKey, unknown>,
        objectPath,
      );
      if (!sceneNode || typeof sceneNode !== "object" || Array.isArray(sceneNode))
        return;

      const target = sceneNode as Record<string, unknown>;
      mergeMissing(target, traitDefinition.defaults as Record<string, unknown>);
    },
    [scene, traits],
  );

  return { traits, mergeTraitInto };
}
