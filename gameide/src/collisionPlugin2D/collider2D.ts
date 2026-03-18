import { defineObject } from "../objectRegistry.js";

export const collider2D = defineObject(
  {
    collider2D: {
      // "circle" or "box"
      shape: "box",
      // Circle radius.
      radius: 10,
      // Box dimensions.
      width: 10,
      height: 10,
      // If true, bodies will fire collision events but not apply physical response.
      isSensor: false,

      // Collision filtering (Matter.js bitmasks).
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

