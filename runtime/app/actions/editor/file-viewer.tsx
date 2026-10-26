import { css, on } from "remix/component";
import type { Handle } from "remix/component";
import { enum_, parseSafe } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

import type { SceneNode } from "../../utilities/scene.ts";
import { game } from "../../../game/game.ts";
import type { FileSession, SharedBlob, SharedFile } from "./file-session.ts";
import { SceneViewer, type SceneRoom } from "./scene-viewer.tsx";

export const supportedFileType = enum_([
  "scene",
  "json",
  "ts",
  "tsx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
] as const);
export type SupportedFileType = InferOutput<typeof supportedFileType>;

export type EditorTab = {
  path: string;
  sharedFile: SharedFile;
  unsubscribe: () => void;
};

function objectUrl(file: SharedBlob) {
  const copy = new Uint8Array(file.bytes.byteLength);
  copy.set(file.bytes);
  return URL.createObjectURL(new Blob([copy], { type: file.mime }));
}

export function FileViewer(
  handle: Handle<{
    file: EditorTab;
    room: SceneRoom;
    session: FileSession;
    onEdit?: () => void;
  }>,
) {
  const { file, onEdit, session } = handle.props;
  const extension = file.path.split(".").pop()?.toLowerCase();
  const fileType = parseSafe(supportedFileType, extension);
  if (!fileType.success) return () => <>{file.path}</>;

  switch (fileType.value) {
    case "scene": {
      if (file.sharedFile.kind !== "text") return () => <>{file.path}</>;
      const shared = file.sharedFile;
      const scene = JSON.parse(shared.text.toString());

      return () => (
        <SceneViewer
          key={file.path}
          scene={scene}
          room={handle.props.room}
          sceneKey={file.path}
          onMount={game}
          document={{
            read: () => shared.text.toString(),
            write(text) {
              session.commitText(file.path, text);
              onEdit?.();
            },
            subscribe: (listener) => session.subscribe(file.path, listener),
          }}
        />
      );
    }
    case "json":
    case "ts":
    case "tsx": {
      if (file.sharedFile.kind !== "text") return () => <>{file.path}</>;
      const shared = file.sharedFile;
      const unsubscribe = session.subscribe(file.path, () => handle.update());
      handle.signal.addEventListener("abort", unsubscribe);

      return () => (
        <textarea
          spellCheck={false}
          value={shared.text.toString()}
          mix={[
            css({
              boxSizing: "border-box",
              border: "none",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              height: "100%",
              margin: 0,
              outline: "none",
              overflow: "auto",
              padding: "1rem",
              resize: "none",
              whiteSpace: "pre",
              width: "100%",
            }),
            on("input", (event) => {
              session.commitText(file.path, event.currentTarget.value);
              onEdit?.();
              handle.update();
            }),
          ]}
        />
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
      const unsubscribe = session.subscribe(file.path, () => {
        URL.revokeObjectURL(url);
        url = objectUrl(shared);
        handle.update();
      });
      handle.signal.addEventListener("abort", () => {
        unsubscribe();
        URL.revokeObjectURL(url);
      });

      return () => (
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
      );
    }
  }
}
