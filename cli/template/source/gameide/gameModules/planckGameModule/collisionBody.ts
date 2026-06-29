import { z } from "zod";
import { defineTrait } from "gameide";

const collisionBodyDataSchema = z.object({
  __icon: z.literal("atom").optional(),
  type: z.enum(["static", "kinematic", "dynamic"]).default("static"),
  velocity: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
      angular: z.number().default(0),
    })
    .default({}),
  fixedRotation: z.boolean().default(false),
  continuous: z.boolean().default(false),
  isTrigger: z.boolean().default(false),
  restitution: z.number().default(0),
  friction: z.number().default(0.3),
  disabled: z.boolean().default(false),
});

export const collisionBodyTrait = defineTrait(
  "CollisionBody2D",
  z.object({
    collisionBody: collisionBodyDataSchema.default({
      __icon: "atom",
      type: "static",
      velocity: { x: 0, y: 0, angular: 0 },
      fixedRotation: false,
      continuous: false,
      isTrigger: false,
      restitution: 0,
      friction: 0.3,
      disabled: false,
    }),
  }),
);
