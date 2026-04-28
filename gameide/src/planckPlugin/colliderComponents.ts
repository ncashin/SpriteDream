import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait, type DefinedTrait } from "../trait/trait.js";
import { transformTrait } from "../trait/transform.js";

/**
 * A Unity-style 2D box collider. Shape is centered on the transform; use `offset` to nudge the shape.
 * Pair with {@link collisionBodyTrait} (or omit it for a static world collider with an implicit static body).
 */
export const boxColliderTrait = defineTrait(
  [
    transformTrait,
    {
      boxCollider: {
        __icon: "square" satisfies IconSlug,
        width: 32,
        height: 32,
        isTrigger: false,
        offset: { x: 0, y: 0 },
      },
    },
  ],
  {
    name: "BoxCollider2D",
    description: "Axis-aligned rectangle used for contact tests.",
    icon: "square" satisfies IconSlug,
  },
);

/**
 * A Unity-style circle collider. `radius` is in the same world units as transform and sprite.
 */
export const circleColliderTrait = defineTrait(
  [
    transformTrait,
    {
      circleCollider: {
        __icon: "circle" satisfies IconSlug,
        radius: 16,
        isTrigger: false,
        offset: { x: 0, y: 0 },
      },
    },
  ],
  {
    name: "CircleCollider2D",
    description: "Circle used for contact tests.",
    icon: "circle" satisfies IconSlug,
  },
);

export type BoxColliderObject =
  typeof boxColliderTrait extends { readonly __gameideTraitType?: infer T }
    ? T
    : never;
export type CircleColliderObject =
  typeof circleColliderTrait extends { readonly __gameideTraitType?: infer T }
    ? T
    : never;
