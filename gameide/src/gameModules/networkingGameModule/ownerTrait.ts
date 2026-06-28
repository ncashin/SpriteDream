import { z } from "zod";
import { OWNER_ID } from "./distributedSimulation.js";
import { defineTrait } from "../../trait/trait.js";

export const ownerTrait = defineTrait(
  z.object({
    [OWNER_ID]: z.string(),
  }),
  {
    name: "Owner",
    description:
      "Peer id that owns this object for networking (replication and local simulation authority).",
  },
);
