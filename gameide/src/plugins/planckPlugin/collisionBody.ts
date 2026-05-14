import { z } from "zod";
import { defineTrait } from "../../trait/trait";

export const collisionBodyTrait = defineTrait(
  z.object({
    collisionBody: z.object({
      __icon: z.literal("atom"),
      type: z.enum(["static", "kinematic", "dynamic"]).default("static"),
      velocity: z.object({
        x: z.number().default(0),
        y: z.number().default(0),
        angular: z.number().default(0),
      }),
      fixedRotation: z.boolean().default(false),
      continuous: z.boolean().default(false),
      isTrigger: z.boolean().default(false),
      restitution: z.number().default(0),
      friction: z.number().default(0.3),
      disabled: z.boolean().default(false),
    }),
  }),
  {
    name: "CollisionBody2D",
    description:
      "How this object participates in the physics step (static / kinematic / dynamic).",
    icon: "atom",
  },
);
