import { useCallback, useMemo } from "react";
import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { getScene } from "../scene/scene.js";
import { getValueAtPath } from "../scene/path.js";
import "../trait/spriteTrait.js";
import "../plugins/planckPlugin/collisionBody.js";
import "../plugins/planckPlugin/colliderComponents.js";
import { getTraitDefinitions, TraitDefinitionEntry } from "../trait/trait.js";

function mergeMissing(target: Record<string, unknown>, incoming: Record<string, unknown>) {
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (!(k in target)) {
      target[k] = v;
    } else if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k])
    ) {
      mergeMissing(target[k] as Record<string, unknown>, v as Record<string, unknown>);
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
    const def = templates.find((t) => t.id === traitId);
    if (!def) return;
    const node = getValueAtPath(
      getScene() as Record<PropertyKey, unknown>,
      objectPath,
    );
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const target = node as Record<string, unknown>;
    mergeMissing(target, def.defaults as Record<string, unknown>);
    if (
      typeof def.icon === "string" &&
      def.icon.trim() !== "" &&
      !("__icon" in target)
    ) {
      target.__icon = def.icon;
    }
  }, [templates]);

  return { templates, mergeTraitInto };
}
