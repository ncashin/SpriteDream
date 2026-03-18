import { defineObject } from "../objectRegistry.js";

export const TransformDefinition2D = defineObject({
  transform2D: {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  }
}, {
    displayName: "Transform 2D",
    description: "Defines 2D transform properties: position, rotation, and scale"
});