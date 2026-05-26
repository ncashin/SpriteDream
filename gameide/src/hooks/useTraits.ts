import { useCallback, useMemo } from "react";
import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { getScene } from "../scene/scene.js";
import { getValueAtPath } from "../scene/path.js";
import "../trait/spriteTrait.js";
import "../plugins/planckPlugin/collisionBody.js";
import "../plugins/planckPlugin/colliderComponents.js";
import { getTraitDefinitions, TraitDefinitionEntry } from "../trait/trait.js";

function mergeMissing(target: Record<string, unknown>, incoming: Record<string, unknown>) {
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;

    if (!(key in target)) {
      target[key] = value;
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      mergeMissing(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    }
  }
}


export function useTraits() {
  const templates = useMemo(
    () =>
      getTraitDefinitions().map((definition: TraitDefinitionEntry, index: number) => ({
        id: index,
        label: definition.name ?? `Trait ${index + 1}`,
        schema: definition.schema,
        icon: definition.icon,
        defaults: definition.defaults,
      })),
    [],
  );

  const mergeTraitInto = useCallback((objectPath: PropertyKey[], traitId: number) => {
    const traitDefinition = templates.find((template) => template.id === traitId);
    if (!traitDefinition) return;

    const sceneNode = getValueAtPath(
      getScene().get() as Record<PropertyKey, unknown>,
      objectPath,
    );
    if (!sceneNode || typeof sceneNode !== "object" || Array.isArray(sceneNode)) return;

    const target = sceneNode as Record<string, unknown>;
    mergeMissing(target, traitDefinition.defaults as Record<string, unknown>);
    if (
      typeof traitDefinition.icon === "string" &&
      traitDefinition.icon.trim() !== "" &&
      !("__icon" in target)
    ) {
      target.__icon = traitDefinition.icon;
    }
  }, [templates]);

  return { templates, mergeTraitInto };
}
