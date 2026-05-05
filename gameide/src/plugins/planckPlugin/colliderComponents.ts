import type { IconSlug } from "../../lucide/lucideIconSlug.js";
import { defineTrait, type DefinedTrait } from "../../trait/trait.js";
import { transformTrait } from "../../trait/transform.js";

export const boxColliderTrait = defineTrait(
  [
    transformTrait,
    {
      boxCollider: {
        __icon: "square" satisfies IconSlug,
        width: 32,
        height: 32,
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

export const circleColliderTrait = defineTrait(
  [
    transformTrait,
    {
      circleCollider: {
        __icon: "circle" satisfies IconSlug,
        radius: 16,
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
