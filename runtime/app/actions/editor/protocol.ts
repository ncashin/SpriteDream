import { boolean, enum_, literal, object, optional, string, variant } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

export const editorMessage = variant("messageType", {
  requestFiles: object({
    messageType: literal("requestFiles"),
  }),
  requestFile: object({
    messageType: literal("requestFile"),
    path: string(),
  }),
  fileState: object({
    messageType: literal("fileState"),
    path: string(),
    kind: enum_(["text", "blob"] as const),
    mime: string(),
    body: string(),
  }),
  fileUpdate: object({
    messageType: literal("fileUpdate"),
    path: string(),
    update: string(),
  }),
  fileMissing: object({
    messageType: literal("fileMissing"),
    path: string(),
  }),
  viewing: object({
    messageType: literal("viewing"),
    path: optional(string()),
    dirty: optional(boolean()),
  }),
});

export type EditorMessage = InferOutput<typeof editorMessage>;
