import { css, on } from "remix/component";
import type { Handle } from "remix/component";
import { enum_, parseSafe } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

import type { SceneNode, ScenePatch } from "../../utilities/scene.ts";
import { game } from "./game.ts";
import { SceneViewer } from "./scene-viewer.tsx";

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

export type OpenFile = {
  path: string;
  file: File;
  dirtyFlag: boolean;
};

function write(file: OpenFile, contents: BlobPart[]) {
  file.file = new File(contents, file.file.name, { type: file.file.type });
  file.dirtyFlag = true;
}

export function FileViewer(handle: Handle<{ file: OpenFile; onEdit?: (patch?: ScenePatch) => void }>) {
  const { file, onEdit } = handle.props;
  const extension = file.path.split(".").pop()?.toLowerCase();
  const fileType = parseSafe(supportedFileType, extension);
  if (!fileType.success) return () => <>{file.path}</>;

  switch (fileType.value) {
    case "scene": {
      let scene: SceneNode | undefined;

      handle.queueTask(async () => {
        if (scene || handle.signal.aborted) return;
        scene = JSON.parse(await file.file.text());
        handle.update();
      });

      return () => {
        if (!scene) return null;
        return (
          <SceneViewer
            key={file.path}
            scene={scene}
            onMount={game}
            onPatch={(patch) => {
              write(file, [`${JSON.stringify(scene, null, 2)}\n`]);
              onEdit?.(patch);
            }}
          />
        );
      };
    }
    case "json":
    case "ts":
    case "tsx": {
      let text = "";
      let ready = false;

      handle.queueTask(async () => {
        if (ready || handle.signal.aborted) return;
        text = await file.file.text();
        ready = true;
        handle.update();
      });

      return () => {
        if (!ready) return null;
        return (
          <textarea
            spellCheck={false}
            value={text}
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
                text = event.currentTarget.value;
                write(file, [text]);
                onEdit?.();
                handle.update();
              }),
            ]}
          />
        );
      };
    }
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg": {
      const url = URL.createObjectURL(file.file);
      handle.signal.addEventListener("abort", () => URL.revokeObjectURL(url));

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
