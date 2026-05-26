import { z } from "zod";
import { defineTrait } from "gameide";

export const transformSchema = z.object({
  position: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(0),
    })
    .default({}),
  rotation: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
      z: z.number().default(0),
    })
    .default({}),
  scale: z
    .object({
      x: z.number().default(1),
      y: z.number().default(1),
      z: z.number().default(1),
    })
    .default({}),
});

export const transformTrait = defineTrait(transformSchema, {
  name: "Transform",
  description: "3D transform properties for scene objects.",
  icon: "axis-3d",
});
