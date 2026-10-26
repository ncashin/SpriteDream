import { literal, number, object, string, variant } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

export const gameMessage = variant("messageType", {
  cursor: object({
    messageType: literal("cursor"),
    sceneKey: string(),
    x: number(),
    y: number(),
  }),
});

export type GameMessage = InferOutput<typeof gameMessage>;
