import { parse } from "remix/data-schema";
import * as Y from "yjs";

import { routes } from "../../routes.ts";
import { projectFiles } from "./routes.ts";
import type { SceneRoom } from "./scene-viewer.tsx";

const textExtensions = new Set(["scene", "json", "ts", "tsx"]);

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
  commitText(path: string, next: string): void;
  subscribe(path: string, listener: () => void): () => void;
  subscribeFiles(listener: () => void): () => void;
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

export function createFileSession(room: SceneRoom, signal: AbortSignal): FileSession {
  const files: Record<string, SharedFile> = {};
  const loading: Record<string, Promise<SharedFile | undefined>> = {};
  const resolvers: Record<string, (file: SharedFile | undefined) => void> = {};
  const fileListeners: Record<string, Set<() => void>> = {};
  const fileListListeners = new Set<() => void>();
  let listed: string[] = [];

  const meta = new Y.Doc();
  const dirtyMap = meta.getMap<boolean>("dirty");

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

  function dirtyFor(path: string) {
    return dirtyMap.get(path) === true;
  }

  function syncDirty(path: string) {
    const file = files[path];
    if (!file) return;

    const dirty = dirtyFor(path);
    if (file.dirty === dirty) return;

    file.dirty = dirty;
    notify(path);
  }

  function setDirty(path: string, dirty: boolean) {
    if ((dirtyMap.get(path) === true) === dirty) return;
    dirtyMap.set(path, dirty);
  }

  function sendUpdate(update: Uint8Array, path?: string) {
    room.send({
      messageType: "fileUpdate",
      path,
      update: toBase64(update),
    });
  }

  meta.on("update", (update, origin) => {
    if (origin === "remote") return;
    sendUpdate(update);
  });

  dirtyMap.observe((event) => {
    for (const path of event.keysChanged) {
      syncDirty(path);
    }
  });

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
    file.doc.on("update", (update, origin) => {
      if (origin === "remote") return;
      sendUpdate(update, file.path);
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

  function putBlob(path: string, mime: string, bytes: Uint8Array) {
    const existing = files[path];

    if (existing?.kind === "blob") {
      existing.mime = mime;
      existing.bytes = bytes;
      notify(path);
      return existing;
    }

    const file: SharedBlob = {
      kind: "blob",
      path,
      mime,
      dirty: dirtyFor(path),
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
        dirty: dirtyFor(path),
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
      const response = await fetch(routes.editor.listFiles.href(), { signal });
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
      const response = await fetch(routes.editor.file.href({ filePath: path }), {
        signal,
      });

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

    sendUpdate(Y.encodeStateAsUpdate(meta));

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

      sendUpdate(Y.encodeStateAsUpdate(meta));

      sendState(file);
    });
  });

  room.onMessageType("fileState", (message) => {
    if (message.sentBy === room.you.id) return;

    const bytes = fromBase64(message.body);
    const file =
      message.kind === "text"
        ? putText(message.path, message.mime, bytes)
        : putBlob(message.path, message.mime, bytes);

    settle(message.path, file);
  });

  room.onMessageType("fileUpdate", (message) => {
    if (message.sentBy === room.you.id) return;

    const update = fromBase64(message.update);

    if (message.path === undefined) {
      Y.applyUpdate(meta, update, "remote");
      return;
    }

    const file = files[message.path];
    if (!file || file.kind !== "text") return;

    Y.applyUpdate(file.doc, update, "remote");
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
      let savedBytes: Uint8Array | undefined;
      let body: Blob;

      if (file.kind === "text") {
        savedText = file.text.toString();
        body = new Blob([savedText], { type: file.mime || "text/plain" });
      } else {
        savedBytes = Uint8Array.from(file.bytes);
        body = new Blob([savedBytes], { type: file.mime || "application/octet-stream" });
      }

      try {
        const response = await fetch(routes.editor.saveFile.href({ filePath: path }), {
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

    commitText(path, next) {
      const file = files[path];
      if (!file || file.kind !== "text") return;

      const previous = file.text.toString();
      if (previous === next) return;

      let start = 0;

      while (
        start < previous.length &&
        start < next.length &&
        previous[start] === next[start]
      ) {
        start++;
      }

      let endPrevious = previous.length;
      let endNext = next.length;

      while (
        endPrevious > start &&
        endNext > start &&
        previous[endPrevious - 1] === next[endNext - 1]
      ) {
        endPrevious--;
        endNext--;
      }

      file.doc.transact(() => {
        if (endPrevious > start) {
          file.text.delete(start, endPrevious - start);
        }

        const insert = next.slice(start, endNext);

        if (insert) {
          file.text.insert(start, insert);
        }
      });

      setDirty(path, true);
    },

    subscribe(path, listener) {
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

    subscribeFiles(listener) {
      fileListListeners.add(listener);

      return () => {
        fileListListeners.delete(listener);
      };
    },
  };
}
