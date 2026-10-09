import { defaulted, instanceof_, object, string } from "remix/data-schema";
import { number } from "remix/data-schema/coerce";

import { defineTrait } from "../trait/trait.ts";
import { loadImage } from "../runtime-assets.ts";
import { applyTransform } from "./transform.ts";

export const imageTrait = defineTrait(
  object({
    transform: instanceof_(DOMMatrix),
    width: number(),
    height: number(),
    tint: string(),
    image: defaulted(string(), ""),
  }),
);

export type Image = NonNullable<ReturnType<typeof imageTrait>>;

export function drawImage(context: CanvasRenderingContext2D, sprite: Image) {
  context.save();
  applyTransform(context, sprite.transform);

  const image = loadImage(sprite.image);
  if (!image) {
    context.fillStyle = sprite.tint;
    context.fillRect(0, 0, sprite.width, sprite.height);
    context.restore();
    return;
  }

  const tinted = applyTintToSprite(image, sprite.width, sprite.height, sprite.tint);
  if (tinted) context.drawImage(tinted, 0, 0, sprite.width, sprite.height);
  context.restore();
}

let tintCanvas: HTMLCanvasElement | undefined;

function applyTintToSprite(image: HTMLImageElement, width: number, height: number, tint: string) {
  const canvas = tintCanvas ?? (tintCanvas = document.createElement("canvas"));
  const pixelWidth = Math.max(1, Math.ceil(width));
  const pixelHeight = Math.max(1, Math.ceil(height));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const layer = canvas.getContext("2d");
  if (!layer) return;

  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.globalCompositeOperation = "source-over";
  layer.imageSmoothingEnabled = false;
  layer.clearRect(0, 0, pixelWidth, pixelHeight);
  layer.drawImage(image, 0, 0, width, height);
  layer.globalCompositeOperation = "multiply";
  layer.fillStyle = tint;
  layer.fillRect(0, 0, width, height);
  layer.globalCompositeOperation = "destination-in";
  layer.drawImage(image, 0, 0, width, height);
  return canvas;
}
