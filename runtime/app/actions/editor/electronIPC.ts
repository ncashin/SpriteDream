import {
  array,
  boolean,
  instanceof_,
  literal,
  object,
  optional,
  parseSafe,
  string,
  variant,
} from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

const ipcRequest = variant("type", {
  "list-files": object({
    type: literal("list-files"),
    project: string(),
  }),
  "read-file": object({
    type: literal("read-file"),
    project: string(),
    filePath: string(),
  }),
  "write-file": object({
    type: literal("write-file"),
    project: string(),
    filePath: string(),
    body: instanceof_(Uint8Array),
  }),
});

const ipcResponse = variant("type", {
  "list-files": object({
    type: literal("list-files"),
    files: array(string()),
  }),
  "read-file": object({
    type: literal("read-file"),
    body: optional(instanceof_(Uint8Array)),
  }),
  "write-file": object({
    type: literal("write-file"),
    ok: boolean(),
  }),
});

type IPCRequest = InferOutput<typeof ipcRequest>;
type IPCResponse = InferOutput<typeof ipcResponse>;

type ResponseFor<MessageType extends IPCRequest["type"]> = Extract<IPCResponse, { type: MessageType }>;
function isResponse<MessageType extends IPCRequest["type"]>(
  value: IPCResponse,
  type: MessageType,
): value is ResponseFor<MessageType> {
  return value.type === type;
}

export function electronRequest<T extends IPCRequest["type"]>(
  message: Extract<IPCRequest, { type: T }>,
): Promise<ResponseFor<T>> {
  return new Promise((resolve, reject) => {
    process.on("message", function onMessage(value) {
      process.off("message", onMessage);

      const parsed = parseSafe(ipcResponse, value);

      if (!parsed.success || !isResponse(parsed.value, message.type)) {
        reject(new Error("Invalid IPC response"));
        return;
      }

      resolve(parsed.value);
    });

    process.send?.(message);
  });
}
