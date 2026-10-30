import { parse } from "remix/data-schema";
import * as Y from "yjs";

import { projectFiles } from "./routes.ts";
import type { SceneRoom } from "./scene-viewer.tsx";

const textExtensions = new Set(["scene", "json", "ts", "tsx", "md"]);

export type SharedText = {
  kind: "text";
  path: string;
  mime: string;
  dirty: boolean;
  doc: Y.Doc;
  text: Y.Text;
};

export type SharedBlob = {
  kind: "blob";
  path: string;
  mime: string;
  dirty: boolean;
  bytes: Uint8Array;
};

export type SharedFile = SharedText | SharedBlob;

export type FileSession = {
  files(): string[];
  isHost(): boolean;
  open(path: string): Promise<SharedFile | undefined>;
  save(path: string): Promise<void>;
  write(path: string, next: string | Uint8Array): void;
  subscribeFile(path: string, listener: () => void): () => void;
  subscribeFileList(listener: () => void): () => void;
};

function isTextPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension !== undefined && textExtensions.has(extension);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;

  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }

  return btoa(binary);
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }

  return true;
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function createFileSession(room: SceneRoom, signal: AbortSignal, baseURL: URL): FileSession {
  const files: Record<string, SharedFile> = {};
  const loading: Record<string, Promise<SharedFile | undefined>> = {};
  const resolvers: Record<string, (file: SharedFile | undefined) => void> = {};
  const fileListeners: Record<string, Set<() => void>> = {};
  const fileListListeners = new Set<() => void>();
  let listed: string[] = [];

  function isHost() {
    return Object.keys(room.people)[0] === room.you.id;
  }

  function notify(path: string) {
    const group = fileListeners[path];
    if (!group) return;

    for (const listener of group) {
      listener();
    }
  }

  function setDirty(path: string, dirty: boolean) {
    const file = files[path];
    if (!file || file.dirty === dirty) return;

    if (file.kind === "blob") {
      file.dirty = dirty;
      notify(path);
      return;
    }

    file.doc.getMap<boolean>("flags").set("dirty", dirty);
  }

  function sendUpdate(path: string, update: Uint8Array) {
    room.send({
      messageType: "fileUpdate",
      path,
      update: toBase64(update),
    });
  }

  function settle(path: string, file: SharedFile | undefined) {
    const resolve = resolvers[path];
    if (!resolve) return;

    delete resolvers[path];
    resolve(file);
  }

  function retain(path: string, promise: Promise<SharedFile | undefined>) {
    loading[path] = promise;

    void promise.finally(() => {
      if (loading[path] === promise) delete loading[path];
    });

    return promise;
  }

  signal.addEventListener("abort", () => {
    for (const path of Object.keys(resolvers)) settle(path, undefined);
  });

  function bind(file: SharedText) {
    const flags = file.doc.getMap<boolean>("flags");

    file.doc.on("update", (update, origin) => {
      if (origin === "remote") return;
      sendUpdate(file.path, update);
    });

    flags.observe(() => {
      const dirty = flags.get("dirty") === true;
      if (file.dirty === dirty) return;

      file.dirty = dirty;
      notify(file.path);
    });

    file.text.observe(() => {
      notify(file.path);
    });
  }

  function sendState(file: SharedFile) {
    if (file.kind === "text") {
      room.send({
        messageType: "fileState",
        path: file.path,
        kind: "text",
        mime: file.mime,
        body: toBase64(Y.encodeStateAsUpdate(file.doc)),
      });
      return;
    }

    room.send({
      messageType: "fileState",
      path: file.path,
      kind: "blob",
      mime: file.mime,
      body: toBase64(file.bytes),
    });
  }

  function putBlob(path: string, mime: string, bytes: Uint8Array, markDirty = false) {
    const existing = files[path];

    if (existing?.kind === "blob") {
      const changed = !sameBytes(existing.bytes, bytes);
      existing.mime = mime;
      existing.bytes = bytes;
      if (changed && markDirty) existing.dirty = true;
      notify(path);
      return existing;
    }

    const file: SharedBlob = {
      kind: "blob",
      path,
      mime,
      dirty: false,
      bytes,
    };

    files[path] = file;
    notify(path);
    return file;
  }

  function putText(path: string, mime: string, state?: Uint8Array) {
    let file = files[path];

    if (!file || file.kind !== "text") {
      const doc = new Y.Doc();
      const text = doc.getText("text");

      file = {
        kind: "text",
        path,
        mime,
        dirty: false,
        doc,
        text,
      };

      files[path] = file;
      bind(file);
    } else {
      file.mime = mime;
    }

    if (state) {
      Y.applyUpdate(file.doc, state, "remote");
    }

    return file;
  }

  async function loadListedFiles() {
    try {
      const response = await fetch(new URL("files", baseURL), { signal });
      if (!response.ok || signal.aborted) return;

      listed = parse(projectFiles, await response.json());
      if (signal.aborted) return;

      for (const listener of fileListListeners) listener();
    } catch (error) {
      if (signal.aborted) return;
      throw error;
    }
  }

  async function readFile(path: string) {
    try {
      const response = await fetch(new URL(`file/${path}`, baseURL), { signal });

      if (!response.ok || signal.aborted) return;

      const mime = response.headers.get("content-type") ?? "";

      if (isTextPath(path)) {
        const initial = await response.text();
        if (signal.aborted) return;

        const file = putText(path, mime);

        if (initial && file.text.length === 0) {
          file.text.insert(0, initial);
        }

        return file;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (signal.aborted) return;

      return putBlob(path, mime, bytes);
    } catch (error) {
      if (signal.aborted) return;
      throw error;
    }
  }

  function loadFromDisk(path: string) {
    const existing = files[path];
    if (existing) return Promise.resolve(existing);

    return loading[path] ?? retain(path, readFile(path));
  }

  function requestAndWait(path: string) {
    const existing = files[path];
    if (existing) return Promise.resolve(existing);

    const inflight = loading[path];
    if (inflight) return inflight;
    if (signal.aborted) return Promise.resolve(undefined);

    const promise = retain(
      path,
      new Promise<SharedFile | undefined>((resolve) => {
        resolvers[path] = resolve;
      }),
    );

    room.send({ messageType: "requestFile", path });
    return promise;
  }

  room.onMessageType("requestFiles", (message) => {
    if (message.sentBy === room.you.id || !isHost()) return;

    for (const file of Object.values(files)) {
      sendState(file);
    }
  });

  room.onMessageType("requestFile", (message) => {
    if (message.sentBy === room.you.id || !isHost()) return;

    void loadFromDisk(message.path).then((file) => {
      if (signal.aborted || !isHost()) return;

      if (!file) {
        room.send({ messageType: "fileMissing", path: message.path });
        return;
      }

      sendState(file);
    });
  });

  room.onMessageType("fileState", (message) => {
    if (message.sentBy === room.you.id) return;

    const bytes = fromBase64(message.body);
    const file =
      message.kind === "text"
        ? putText(message.path, message.mime, bytes)
        : putBlob(message.path, message.mime, bytes, true);

    settle(message.path, file);
  });

  room.onMessageType("fileUpdate", (message) => {
    if (message.sentBy === room.you.id) return;

    const file = files[message.path];
    if (!file || file.kind !== "text") return;

    Y.applyUpdate(file.doc, fromBase64(message.update), "remote");
  });

  room.onMessageType("fileMissing", (message) => {
    if (message.sentBy === room.you.id) return;
    if (files[message.path]) return;

    settle(message.path, undefined);
  });

  if (!isHost() && !signal.aborted) {
    room.send({ messageType: "requestFiles" });
  }

  void loadListedFiles();

  return {
    files() {
      return listed;
    },

    isHost,

    open(path) {
      if (signal.aborted) return Promise.resolve(undefined);
      if (isHost()) return loadFromDisk(path);
      return requestAndWait(path);
    },

    async save(path) {
      const file = files[path];
      if (!file || !file.dirty || signal.aborted) return;

      let savedText: string | undefined;
      let savedBytes: Uint8Array<ArrayBuffer> | undefined;
      let body: Blob;

      if (file.kind === "text") {
        savedText = file.text.toString();
        body = new Blob([savedText], { type: file.mime || "text/plain" });
      } else {
        savedBytes = file.bytes.slice();
        body = new Blob([savedBytes], { type: file.mime || "application/octet-stream" });
      }

      try {
        const response = await fetch(new URL(`file/${path}`, baseURL), {
          method: "PUT",
          body,
          signal,
          headers: {
            "content-type": body.type || "application/octet-stream",
          },
        });

        if (!response.ok || signal.aborted) return;

        const current = files[path];
        if (!current) return;

        const unchanged =
          current.kind === "text"
            ? current.text.toString() === savedText
            : savedBytes !== undefined && sameBytes(current.bytes, savedBytes);

        if (unchanged) setDirty(path, false);
      } catch (error) {
        if (signal.aborted) return;
        throw error;
      }
    },

    write(path, next) {
      const file = files[path];
      if (!file) return;

      if (file.kind === "blob") {
        const bytes = typeof next === "string" ? new TextEncoder().encode(next) : next;
        if (sameBytes(file.bytes, bytes)) return;

        file.bytes = bytes;
        setDirty(path, true);
        sendState(file);
        return;
      }

      const text = typeof next === "string" ? next : new TextDecoder().decode(next);
      const previous = file.text.toString();
      if (previous === text) return;

      let start = 0;

      while (start < previous.length && start < text.length && previous[start] === text[start]) {
        start++;
      }

      let endPrevious = previous.length;
      let endNext = text.length;

      while (
        endPrevious > start &&
        endNext > start &&
        previous[endPrevious - 1] === text[endNext - 1]
      ) {
        endPrevious--;
        endNext--;
      }

      file.doc.transact(() => {
        if (endPrevious > start) {
          file.text.delete(start, endPrevious - start);
        }

        const insert = text.slice(start, endNext);

        if (insert) {
          file.text.insert(start, insert);
        }

        setDirty(path, true);
      });
    },

    subscribeFile(path, listener) {
      let group = fileListeners[path];

      if (!group) {
        group = new Set();
        fileListeners[path] = group;
      }

      group.add(listener);

      return () => {
        group.delete(listener);
      };
    },

    subscribeFileList(listener) {
      fileListListeners.add(listener);

      return () => {
        fileListListeners.delete(listener);
      };
    },
  };
}
