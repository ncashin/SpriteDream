import { clientEntry, css } from "remix/component";
import type { Handle } from "remix/component";
import { enum_, parseSafe } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

import { filterScene, type SceneNode } from "../../utilities/scene.ts";
import { selectedObjects } from "../../utilities/selected-objects.ts";
import { colliderTrait } from "../../utilities/physics.ts";
import { createUpdateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { createViewport } from "../../utilities/viewport/viewport.ts";
import { SceneViewer } from "./scene-viewer.tsx";

export const supportedFileType = enum_(["scene", "json", "ts", "tsx"] as const);
export type SupportedFileType = InferOutput<typeof supportedFileType>;

export type ProjectFile = {
  type: SupportedFileType;
  path: string;
  content: string;
};

export const FileViewer = clientEntry(
  import.meta.url,
  function FileViewer(handle: Handle<{ file: ProjectFile }>) {
    const { file } = handle.props;
    let content = file.content;

    return () => {
      const fileType = parseSafe(supportedFileType, file.type);
      if (!fileType.success) return <>Unsupported File Type</>;

      switch (file.type) {
        case "scene":
          const parsedContent = JSON.parse(content);
          return (
            <SceneViewer
              key={file.path}
              scene={parsedContent}
              onSave={(next) => {
                content = next;
              }}
              onMount={(canvas, scene) => {
                if (!scene) return;
                const updateLoop = createUpdateLoop({ signal: handle.signal });
                const viewport = createViewport(canvas, {
                  signal: handle.signal,
                });

                updateLoop.onUpdate(() => {
                  viewport.beginDrawing();

                  for (const image of filterScene(scene, imageTrait)) {
                    viewport.drawImage(image);
                  }

                  for (const text of filterScene(scene, textTrait)) {
                    viewport.drawText(text);
                  }

                  for (const frame of filterScene(scene, frameTrait)) {
                    viewport.drawFrame(frame);
                  }

                  for (const collider of filterScene(scene, colliderTrait)) {
                    viewport.drawPhysicsCollider(collider);
                  }

                  for (const object of selectedObjects) {
                    viewport.drawBoundingBox(object);
                  }
                });

                if (handle.signal.aborted) return;
                updateLoop.start();
              }}
            />
          );
        case "json":
        case "ts":
        case "tsx":
          return (
            <pre
              mix={css({
                boxSizing: "border-box",
                height: "100%",
                margin: 0,
                overflow: "auto",
                padding: "1rem",
                whiteSpace: "pre-wrap",
              })}
            >
              {content}
            </pre>
          );
      }
    };
  },
);
