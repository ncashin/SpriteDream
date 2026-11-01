import { css } from "remix/component";
import type { Handle } from "remix/component";
import { enum_, parseSafe } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

import { game } from "../../../game/game.ts";
import { CodeViewer } from "./code-viewer.tsx";
import type { SharedBlob } from "./file-session.ts";
import { FileSessionProvider } from "./file-session-provider.tsx";
import { PresenceProvider } from "./presence-provider.tsx";
import { RoomProvider } from "./room-provider.tsx";
import { SceneViewer } from "./sceneViewer/scene-viewer.tsx";
import type { EditorTab } from "./editor.tsx";

export const supportedFileType = enum_([
  "scene",
  "json",
  "js",
  "ts",
  "tsx",
  "md",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
] as const);
export type SupportedFileType = InferOutput<typeof supportedFileType>;

function objectUrl(file: SharedBlob) {
  const copy = new Uint8Array(file.bytes.byteLength);
  copy.set(file.bytes);
  return URL.createObjectURL(new Blob([copy], { type: file.mime }));
}

export function FileViewer(
  handle: Handle<{
    file: EditorTab;
    onEdit?: () => void;
  }>,
) {
  const { file, onEdit } = handle.props;
  const { room } = handle.context.get(RoomProvider);
  const session = handle.context.get(FileSessionProvider);
  const extension = file.path.split(".").pop()?.toLowerCase();
  const fileType = parseSafe(supportedFileType, extension);
  if (!fileType.success) return () => <>File Type Not Supported</>;

  switch (fileType.value) {
    case "scene": {
      if (file.sharedFile.kind !== "text") return () => <>{file.path}</>;
      const shared = file.sharedFile;
      const scene = JSON.parse(shared.text.toString());

      return () => (
        <PresenceProvider path={file.path} draw={false}>
          <SceneViewer
            key={file.path}
            scene={scene}
            room={room}
            sceneKey={file.path}
            onMount={game}
            document={{
              read: () => shared.text.toString(),
              write(text) {
                session.write(file.path, text);
                onEdit?.();
              },
              subscribe: (listener) => session.subscribeFile(file.path, listener),
            }}
          />
        </PresenceProvider>
      );
    }
    case "json":
    case "js":
    case "ts":
    case "tsx":
    case "md": {
      if (file.sharedFile.kind !== "text") return () => <>{file.path}</>;
      const shared = file.sharedFile;

      return () => (
        <PresenceProvider path={file.path}>
          <CodeViewer key={file.path} path={file.path} text={shared.text} onEdit={onEdit} />
        </PresenceProvider>
      );
    }
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg": {
      if (file.sharedFile.kind !== "blob") return () => <>{file.path}</>;
      const shared = file.sharedFile;
      let url = objectUrl(shared);
      const unsubscribe = session.subscribeFile(file.path, () => {
        URL.revokeObjectURL(url);
        url = objectUrl(shared);
        handle.update();
      });
      handle.signal.addEventListener("abort", () => {
        unsubscribe();
        URL.revokeObjectURL(url);
      });

      return () => (
        <PresenceProvider path={file.path}>
          <img
            alt={file.path}
            src={url}
            mix={css({
              display: "block",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            })}
          />
        </PresenceProvider>
      );
    }
  }
}
