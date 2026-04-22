import { defineTrait } from "./trait.js";

export const transformTrait = defineTrait(
  {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    scale: {
      x: 1,
      y: 1,
      z: 1,
    },
  },
  {
    name: "Transform",
    description: "3D transform properties for scene objects.",
    icon: "cuboid",
  },
);
