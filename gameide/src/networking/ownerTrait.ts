import { defineTrait, $string } from "../trait/trait.js";
import { OWNER_ID } from "./distributedSimulation.js";

export const ownerTrait = defineTrait(
  {
    [OWNER_ID]: $string,
  },
  {
    name: "Owner",
    description:
      "Peer id that owns this object for networking (replication and local simulation authority).",
  },
);
