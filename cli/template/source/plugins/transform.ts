import { z } from "zod";
import { defineTrait } from "gameide";

export const transformSchema = z.object({
  position: z
    .object({
      __icon: z.literal("move-3d").optional(),
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(0),
    })
    .default({ __icon: "move-3d", x: 0, y: 0, z: 0 }),
  rotation: z
    .object({
      __icon: z.literal("rotate-3d").optional(),
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(0),
    })
    .default({ __icon: "rotate-3d", x: 0, y: 0, z: 0 }),
  scale: z
    .object({
      __icon: z.literal("scaling").optional(),
      x: z.number().default(1),
      y: z.number().default(1),
      z: z.number().default(1),
    })
    .default({ __icon: "scaling", x: 1, y: 1, z: 1 }),
});

export const transformTrait = defineTrait(transformSchema, {
  name: "Transform",
  description: "3D transform properties for scene objects.",
  icon: "axis-3d",
});
