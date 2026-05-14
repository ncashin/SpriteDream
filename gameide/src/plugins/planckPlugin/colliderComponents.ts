import { z } from "zod";
import type { IconSlug } from "../../lucide/lucideIconSlug.js";
import { transformTrait } from "../../trait/transform.js";
import { defineTrait } from "../../index.js";

export const boxColliderTrait = defineTrait(
  z.object({
    boxCollider: z.object({
      __icon: z.literal("square" satisfies IconSlug),
      width: z.number().default(32),
      height: z.number().default(32),
      offset: z.object({
        x: z.number().default(0),
        y: z.number().default(0),
      }),
    }),
  }),

  {
    name: "BoxCollider2D",
    description: "Axis-aligned rectangle used for contact tests.",
    icon: "square",
  },
);

export const circleColliderTrait = defineTrait(
  z.object({
    circleCollider: z.object({
      __icon: z.literal("circle" satisfies IconSlug),
      radius: z.number().default(16),
      offset: z.object({
        x: z.number().default(0),
        y: z.number().default(0),
      }),
    }),
  }),
  {
    name: "CircleCollider2D",
    description: "Circle used for contact tests.",
    icon: "circle",
  },
);
