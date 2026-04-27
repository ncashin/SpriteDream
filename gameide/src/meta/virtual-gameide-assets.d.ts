declare module "virtual:gameide-assets" {
  export type GameIDEAssets = { readonly importPath: string };
  export function loadAssets(): GameIDEAssets;
}
