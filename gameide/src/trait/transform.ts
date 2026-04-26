import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait } from "./trait.js";

export const transformTrait = defineTrait(
  {
    position: {
      __icon: "move-3d" satisfies IconSlug,
      x: 0,
      y: 0,
      z: 0,
    },
    rotation: {
      __icon: "rotate-3d" satisfies IconSlug,
      x: 0,
      y: 0,
      z: 0,
    },
    scale: {
      __icon: "scaling" satisfies IconSlug,
      x: 1,
      y: 1,
      z: 1,
    },
  },
  {
    name: "Transform",
    description: "3D transform properties for scene objects.",
    icon: "axis-3d" satisfies IconSlug,
  },
);
