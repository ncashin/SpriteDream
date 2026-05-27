declare module "gameide:assets" {
  /** Project-relative paths inside the assets folder (for use with `assetURL`). */
  const assets: readonly string[];
  export default assets;
}

declare module "gameide:scenes" {
  /** Project-relative `.scene` file paths. */
  const scenes: readonly string[];
  export default scenes;
}
