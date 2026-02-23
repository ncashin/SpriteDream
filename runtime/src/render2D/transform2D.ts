import { defineObject } from "../scene/objectDefinition";

export const Transform2DDefinition = defineObject({
  transform2D: {
    __icon: "Move",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  },
});
