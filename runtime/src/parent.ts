import { z } from "zod";
import { defineComponent } from "./components";

export const ParentComponent = defineComponent(
  "parent",
  z.object({
    parent: z.string(),
  }),
  {
    parent: "undefined",
  },
);
