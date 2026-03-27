import { defineObject } from "../objectRegistry.js";

export const collider2D = defineObject(
  {
    collider2D: {
      shape: "box",
      radius: 10,
      width: 10,
      height: 10,
      isSensor: false,
      category: 0x0001,
      mask: 0xffff,
      group: 0,
    },
  },
  {
    displayName: "Collider 2D",
    description: "Collider shape and collision filtering used by collisionPlugin2D",
  },
);
