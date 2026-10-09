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

  context.drawImage(image, 0, 0, sprite.width, sprite.height);
  context.globalCompositeOperation = "multiply";
  context.fillStyle = sprite.tint;
  context.fillRect(0, 0, sprite.width, sprite.height);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(image, 0, 0, sprite.width, sprite.height);
  context.restore();
}
