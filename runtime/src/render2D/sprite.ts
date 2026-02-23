import { defineObject, type Instance } from "../scene/objectDefinition";
import { transform2DDefinition } from "./transform2D";

/** Definition shape so query/onQueryChange infer SpriteInstance and property update types */
export type SpriteDefinition = {
  transform2D: { x: number; y: number; rotation: number };
  sprite: { image: string; width: number; height: number };
};

export const spriteDefinition = defineObject([
  transform2DDefinition,
  {
    sprite: {
      image: "",
      width: 0,
      height: 0,
    },
  },
]) as { __hash: string; __definition: SpriteDefinition };

export type SpriteInstance = Instance<SpriteDefinition>;
