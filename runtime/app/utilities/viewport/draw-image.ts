import { defaulted, object, string } from "remix/data-schema";
import { number } from "remix/data-schema/coerce";

import { defineTrait } from "../trait/trait.ts";
import { loadImage } from "../runtime-assets.ts";

export const image = defineTrait(
  object({
    x: number(),
    y: number(),
    width: number(),
    height: number(),
    rotation: number(),
    tint: string(),
    image: defaulted(string(), ""),
  }),
);

export type Image = NonNullable<ReturnType<typeof image>>;

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function drawImage(context: CanvasRenderingContext2D, sprite: Image) {
  const originX = sprite.x + sprite.width / 2;
  const originY = sprite.y + sprite.height / 2;
  const x = -sprite.width / 2;
  const y = -sprite.height / 2;
  context.save();
  context.translate(originX, originY);
  context.rotate(radians(sprite.rotation));

  const image = loadImage(sprite.image);
  if (!image) {
    context.fillStyle = sprite.tint;
    context.fillRect(x, y, sprite.width, sprite.height);
    context.restore();
    return;
  }

  context.drawImage(image, x, y, sprite.width, sprite.height);
  context.globalCompositeOperation = "multiply";
  context.fillStyle = sprite.tint;
  context.fillRect(x, y, sprite.width, sprite.height);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(image, x, y, sprite.width, sprite.height);
  context.restore();
}
