import { z } from "zod";
import { defineTrait } from "gameide";

const boxColliderDataSchema = z.object({
  __icon: z.literal("square").optional(),
  width: z.number().default(32),
  height: z.number().default(32),
  offset: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
    })
    .default({}),
});

export const boxColliderTrait = defineTrait(
  "BoxCollider2D",
  z.object({
    boxCollider: boxColliderDataSchema.default({
      __icon: "square",
      width: 32,
      height: 32,
      offset: { x: 0, y: 0 },
    }),
  }),
);

const circleColliderDataSchema = z.object({
  __icon: z.literal("circle").optional(),
  radius: z.number().default(16),
  offset: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
    })
    .default({}),
});

export const circleColliderTrait = defineTrait(
  "CircleCollider2D",
  z.object({
    circleCollider: circleColliderDataSchema.default({
      __icon: "circle",
      radius: 16,
      offset: { x: 0, y: 0 },
    }),
  }),
);
