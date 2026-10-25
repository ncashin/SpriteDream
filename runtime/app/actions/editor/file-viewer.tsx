import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";
import { enum_, parseSafe } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

import type { SceneNode } from "../../utilities/scene.ts";
import { game } from "./game.ts";
import { SceneViewer } from "./scene-viewer.tsx";

export const supportedFileType = enum_(["scene", "json", "ts", "tsx"] as const);
export type SupportedFileType = InferOutput<typeof supportedFileType>;

export type OpenFile = {
  path: string;
  saved: string;
  text: string;
  scene?: SceneNode;
};

export function fileBody(file: OpenFile) {
  return file.scene ? `${JSON.stringify(file.scene, null, 2)}\n` : file.text;
}

export function fileUnsaved(file: OpenFile) {
  if (file.scene) return JSON.stringify(file.scene) !== file.saved;
  return file.text !== file.saved;
}

export const FileViewer = clientEntry(
  import.meta.url,
  function FileViewer(handle: Handle<{ file: OpenFile; onEdit?: () => void }>) {
    const { file, onEdit } = handle.props;

    return () => {
      const extension = file.path.split(".").pop();
      const fileType = parseSafe(supportedFileType, extension);
      if (!fileType.success) return <>Unsupported File Type</>;

      switch (fileType.value) {
        case "scene":
          if (!file.scene) return <>Unsupported File Type</>;
          return (
            <SceneViewer
              key={file.path}
              scene={file.scene}
              onMount={game}
            />
          );
        case "json":
        case "ts":
        case "tsx":
          return (
            <textarea
              spellCheck={false}
              value={file.text}
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
                  file.text = event.currentTarget.value;
                  onEdit?.();
                  handle.update();
                }),
              ]}
            />
          );
      }
    };
  },
);
