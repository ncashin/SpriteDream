import { any, array, literal, number, object, optional, string, variant } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

export const gameMessage = variant("messageType", {
  cursor: object({
    messageType: literal("cursor"),
    sceneKey: string(),
    x: number(),
    y: number(),
  }),
  scenePatch: object({
    messageType: literal("scenePatch"),
    sceneKey: string(),
    patch: array(
      object({
        path: array(string()),
        value: optional(any()),
      }),
    ),
  }),
});

export type GameMessage = InferOutput<typeof gameMessage>;
