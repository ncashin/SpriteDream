import { z } from "zod";
import type { Serializable, SerializableObject } from "./tomove/scene";

const serializableSchema: z.ZodType<Serializable> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(serializableSchema),
    z.record(z.string(), serializableSchema),
  ]),
);
const serializableObjectSchema: z.ZodType<SerializableObject> = z.lazy(() =>
  z.record(z.string(), serializableSchema),
);

export const modeSchema = z.enum(["editor", "game"]);

export const editorStoreSchema = z.object({
  selectedObjects: z.array(z.string()),
  scene: serializableObjectSchema,
  mode: modeSchema,
});

export const editorStorePatchSchema = z.object({
  type: z.literal("editorStorePatch"),
  patch: z.object({
    selectedObjects: z.array(z.string()).optional(),
    scene: serializableSchema.optional(),
    mode: modeSchema.optional(),
  }),
});

export const editorStoreStateSchema = z.object({
  type: z.literal("editorStoreState"),
  state: editorStoreSchema,
});

export const editorStoreRequestStateSchema = z.object({
  type: z.literal("editorStoreRequestState"),
});

export const editorStoreMessageSchema = z.discriminatedUnion("type", [
  editorStorePatchSchema,
  editorStoreStateSchema,
  editorStoreRequestStateSchema,
]);

export type EditorStoreMessage = z.infer<typeof editorStoreMessageSchema>;
export type EditorStoreState = z.infer<typeof editorStoreSchema>;
