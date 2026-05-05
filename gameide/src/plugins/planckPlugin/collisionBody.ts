import type { IconSlug } from "../../lucide/lucideIconSlug.js";
import { defineTrait, type DefinedTrait } from "../../trait/trait.js";

export const collisionBodyTrait = defineTrait(
  {
    collisionBody: {
      __icon: "atom",
      type: "static",
      velocity: { x: 0, y: 0, angular: 0 },
      fixedRotation: false,
      isTrigger: false,
      restitution: 0,
      friction: 0.3,
      disabled: false,
    },
  },
  {
    name: "CollisionBody2D",
    description: "How this object participates in the physics step (static / kinematic / dynamic).",
    icon: "atom",
  },
);
