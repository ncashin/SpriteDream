declare module "virtual:gameide-assets" {
  export type GameIDEAssets = Record<string, never>;
  export function loadAssets(): GameIDEAssets;
}
