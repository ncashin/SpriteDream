import AppWindow from "lucide/dist/esm/icons/app-window.mjs";
import { css, Frame } from "remix/component";
import type { RemixNode } from "remix/component";
import { defaulted, object, string } from "remix/data-schema";
import { number } from "remix/data-schema/coerce";

import { addBoundingBoxLookup } from "../bounding-box.ts";
import { Mode, mode } from "../mode.ts";
import { objectPath, scene } from "../scene.ts";
import { defineTrait } from "../trait/trait.ts";
import { transform } from "./transform.ts";
import { drawComponentKey } from "./draw-component.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

export const frameTrait = defineTrait(
  "Frame",
  AppWindow,
  object({
    frameSource: defaulted(string(), ""),
    width: defaulted(number(), 320),
    height: defaulted(number(), 240),
  }),
);

export type FrameObject = NonNullable<ReturnType<typeof frameTrait>>;

addBoundingBoxLookup((object) => {
  const frame = frameTrait(object);
  if (!frame) return;
  return {
    width: frame.frame.width,
    height: frame.frame.height,
    resizeCallback: ({ width, height }) => {
      frame.frame.width = width;
      frame.frame.height = height;
    },
  };
});

export function drawFrame(
  viewport: ViewportWithTransforms & {
    drawComponent(key: object | string, transform: DOMMatrix, node: RemixNode): void;
  },
  frame: FrameObject,
) {
  const source = frame.frame.frameSource;
  const path = objectPath(scene, frame)?.join(".");
  const worldMatrix = transform(frame)?.matrix;
  if (!source || !worldMatrix) return;

  const { width, height } = frame.frame;
  const placed = new DOMMatrix().translate(-width / 2, -height / 2);
  const playing = mode === Mode.Play;
  viewport.drawComponent(
    drawComponentKey(frame, "frame"),
    worldMatrix.multiply(placed),
    <div
      data-scene-object={path}
      data-frame-passthrough={playing ? undefined : ""}
      mix={[
        css({
          boxSizing: "border-box",
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: `${width}px`,
          maxHeight: `${height}px`,
          overflow: "hidden",
          contain: "size",
          pointerEvents: playing ? "auto" : "none",
        }),
      ]}
    >
      <Frame src={source} />
    </div>,
  );
}
