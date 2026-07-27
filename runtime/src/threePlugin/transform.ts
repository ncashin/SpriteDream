import { z } from "zod";
import { defineComponent } from "../components";

export const TransformComponent = defineComponent(
  "transform",
  z.object({
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),

    rotation: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),

    scale: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
  }),
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
);
