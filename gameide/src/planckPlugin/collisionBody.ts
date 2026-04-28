import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait, type DefinedTrait } from "../trait/trait.js";

/**
 * A Unity Rigidbody2D–style body: static (scene/props), kinematic (moved in code, pushes dynamics),
 * or dynamic (fully simulated). At least one body on a contact pair must be non-static for meaningful
 * physics; pair this trait with a box or circle collider.
 *
 * **`fixedRotation`:** When true (typical on dynamic bodies), the solver applies no torque—the body stays at its authored yaw unless you set `rotation.z`/`angle` yourself.
 */
export const collisionBodyTrait = defineTrait(
  {
    collisionBody: {
      __icon: "atom" satisfies IconSlug,
      type: "static" as "static" | "kinematic" | "dynamic",
      /** Scene-space linear velocity (units/sec). Applied to Planck before each step for dynamic bodies; updated from the simulation after the step. */
      velocity: { x: 0, y: 0 },
      /** If true, Planck ignores torque for this body (no tipping from collisions; common for characters). Ignored vs scene-driven rotation for kinematic/static. */
      fixedRotation: false as boolean,
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
