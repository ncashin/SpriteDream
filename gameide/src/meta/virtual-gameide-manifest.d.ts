import type { GameIDEMetadata } from "./gameideManifestTypes.js";

declare module "virtual:gameide-manifest" {
  const manifest: GameIDEMetadata;
  export default manifest;
}
