import ImageIcon from "lucide/dist/esm/icons/image.mjs";
import { defaulted, object, string } from "remix/data-schema";
import { number } from "remix/data-schema/coerce";

import { addBoundingBoxLookup } from "../bounding-box.ts";
import { loadImage } from "../runtime-assets.ts";
import { defineTrait } from "../trait/trait.ts";
import { applyTransform, transform } from "./transform.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

export const imageTrait = defineTrait(
  "Image",
  ImageIcon,
  object({
    width: defaulted(number(), 64),
    height: defaulted(number(), 64),
    tint: defaulted(string(), "#f4f4f5ff"),
    image: defaulted(string(), "default.png"),
  }),
);

export type Image = NonNullable<ReturnType<typeof imageTrait>>;

addBoundingBoxLookup((object) => {
  const image = imageTrait(object);
  if (!image) return;
  return {
    width: image.image.width,
    height: image.image.height,
    resizeCallback: ({ width, height }) => {
      image.image.width = width;
      image.image.height = height;
    },
  };
});

export function drawImage(viewportWithTransforms: ViewportWithTransforms, sprite: Image) {
  const context = viewportWithTransforms.state.context;
  const worldMatrix = transform(sprite)?.matrix;
  if (!worldMatrix) return;

  context.save();
  applyTransform(context, worldMatrix);

  const x = -sprite.image.width / 2;
  const y = -sprite.image.height / 2;
  const image = loadImage(sprite.image.image);
  if (!image) {
    context.fillStyle = sprite.image.tint;
    context.fillRect(x, y, sprite.image.width, sprite.image.height);
    context.restore();
    return;
  }

  const tinted = applyTintToImage(image, sprite.image.width, sprite.image.height, sprite.image.tint);
  if (tinted) context.drawImage(tinted, x, y, sprite.image.width, sprite.image.height);
  context.restore();
}

let tintCanvas: HTMLCanvasElement | undefined;

function applyTintToImage(image: HTMLImageElement, width: number, height: number, tint: string) {
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
