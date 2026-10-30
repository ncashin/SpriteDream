import { array, literal, object, string, variant } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

export const roomMessage = variant("messageType", {
  onRoomJoin: object({
    messageType: literal("onRoomJoin"),
    id: string(),
    people: array(string()),
  }),
  onPersonJoin: object({
    messageType: literal("onPersonJoin"),
    id: string(),
  }),
  onPersonLeave: object({
    messageType: literal("onPersonLeave"),
    id: string(),
  }),
});

export type RoomMessage = InferOutput<typeof roomMessage>;
