import { z } from "zod";
import { defineTrait } from "gameide";

export const boxColliderTrait = defineTrait(
  z.object({
    boxCollider: z.object({
      __icon: z.literal("square"),
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
      __icon: z.literal("circle"),
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
