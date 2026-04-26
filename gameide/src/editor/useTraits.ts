import { useCallback, useMemo } from "react";
import {
  $boolean,
  $number,
  $string,
  getDefinedTraitsForEditor,
  type SchemaObject,
  type SchemaValue,
} from "../trait/trait.js";
import { getScene } from "../scene/scene.js";
import { getValueAtPath } from "../scene/path.js";
import "../threePlugin/threePlugin.js";

function defaultFromSchemaValue(v: SchemaValue): unknown {
  if (v === $number) return 0;
  if (v === $string) return "";
  if (v === $boolean) return false;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(v as SchemaObject)) {
      o[k] = defaultFromSchemaValue(child);
    }
    return o;
  }
  return undefined;
}

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

export type TraitTemplate = { id: number; label: string; schema: SchemaObject };

export function useTraits() {
  const templates: TraitTemplate[] = useMemo(
    () =>
      getDefinedTraitsForEditor().map((def, i) => ({
        id: i,
        label: def.name ?? `Trait ${i + 1}`,
        schema: def.schema,
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
    mergeMissing(node as Record<string, unknown>, defaultFromSchemaValue(def.schema) as Record<string, unknown>);
  }, [templates]);

  return { templates, mergeTraitInto };
}
