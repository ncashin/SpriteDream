import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait, type DefinedTrait } from "../trait/trait.js";

export const collisionBodyTrait = defineTrait(
  {
    collisionBody: {
      __icon: "atom" satisfies IconSlug,
      type: "static" as "static" | "kinematic" | "dynamic",
      velocity: { x: 0, y: 0, angular: 0 },
      fixedRotation: false as boolean,
      isTrigger: false as boolean,
      restitution: 0 as number,
      /** Planck fixture friction; mixed with other fixture via sqrt. Use 0 for characters to avoid sticking on walls. */
      friction: 0.3 as number,
      /** When true, no physics body mirrors this collider until enabled again (no collisions or contacts). */
      disabled: false as boolean,
    },
  },
  {
    name: "CollisionBody2D",
    description: "How this object participates in the physics step (static / kinematic / dynamic).",
    icon: "atom" satisfies IconSlug,
  },
);

export type CollisionBodyObject =
  typeof collisionBodyTrait extends DefinedTrait<infer T> ? T : never;
