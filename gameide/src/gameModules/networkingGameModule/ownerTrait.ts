import { z } from "zod";
import { OWNER_ID } from "./distributedSimulation.js";
import { defineTrait } from "../../trait/trait.js";

export const ownerTrait = defineTrait(
  "Owner",
  z.object({
    [OWNER_ID]: z.string(),
  }),
);
