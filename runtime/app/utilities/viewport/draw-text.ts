import Type from "lucide/dist/esm/icons/type.mjs";
import { defaulted, object, string } from "remix/data-schema";
import { number } from "remix/data-schema/coerce";

import { addBoundingBoxLookup } from "../bounding-box.ts";
import { defineTrait } from "../trait/trait.ts";
import { applyTransform, transform } from "./transform.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

export const textTrait = defineTrait(
  "Text",
  Type,
  object({
    value: defaulted(string(), "Text"),
    font: defaulted(string(), ""),
    fontWeight: defaulted(number(), 400),
    fontSize: defaulted(number(), 24),
    color: defaulted(string(), "#f4f4f5ff"),
  }),
);

export type Text = NonNullable<ReturnType<typeof textTrait>>;

addBoundingBoxLookup((object) => {
  const text = textTrait(object);
  if (!text) return;
  const size = measureText(text);
  return {
    width: size.width,
    height: size.height,
  };
});

export function drawText(viewportWithTransforms: ViewportWithTransforms, text: Text) {
  const context = viewportWithTransforms.state.context;
  const worldMatrix = transform(text)?.matrix;
  if (!worldMatrix) return;

  const { value, font, fontWeight, fontSize, color } = text.text;
  context.save();
  applyTransform(context, worldMatrix);
  context.font = fontFace(fontSize, fontWeight, font);
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(value, 0, 0);
  context.restore();
}

let measureContext: CanvasRenderingContext2D | undefined;

function measureText(text: Text) {
  const context =
    measureContext ??
    (measureContext = document.createElement("canvas").getContext("2d") ?? undefined);
  const { value, font, fontWeight, fontSize } = text.text;
  if (!context) return { width: fontSize, height: fontSize };
  context.font = fontFace(fontSize, fontWeight, font);
  return {
    width: Math.max(1, context.measureText(value).width),
    height: fontSize,
  };
}

const loadedFonts = new Map<string, { family: string; ready: Promise<void> }>();

export function prepareFont(source: string): Promise<void> {
  return loadFont(source)?.ready ?? Promise.resolve();
}

function fontFace(fontSize: number, fontWeight: number, source: string) {
  const weight = Math.min(1000, Math.max(1, Math.round(fontWeight) || 400));
  const family = loadFont(source)?.family;
  return family
    ? `${weight} ${fontSize}px "${family}", sans-serif`
    : `${weight} ${fontSize}px sans-serif`;
}

function loadFont(source: string) {
  const path = source.trim();
  if (!path) return;
  const ready = loadedFonts.get(path);
  if (ready) return ready;
  const family = `scene-${loadedFonts.size}`;
  const face = new FontFace(family, `url(${JSON.stringify(path)})`, { weight: "1 1000" });
  const entry = {
    family,
    ready: face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
      },
      () => {
        // Keep the entry so a missing file is not requested again every frame.
      },
    ),
  };
  loadedFonts.set(path, entry);
  return entry;
}
