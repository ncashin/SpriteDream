import { z } from "zod";
import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait } from "./trait.js";
import { transformSchema } from "./transform.js";

const spriteFieldsSchema = z.object({
  sprite: z.object({
    __icon: z.literal("image" satisfies IconSlug),
    asset: z.string().default(""),
    width: z.number().default(1),
    height: z.number().default(1),
    tint: z.string().default("#ffffff"),
  }),
});

export const spriteRenderableSchema = transformSchema.merge(spriteFieldsSchema);

export type SpriteRenderable = z.infer<typeof spriteRenderableSchema>;

export const spriteTrait = defineTrait(spriteRenderableSchema, {
  name: "Sprite",
  description: "2D textured sprite from the project assets folder.",
  icon: "image" satisfies IconSlug,
});
