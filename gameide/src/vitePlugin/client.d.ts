declare module "gameide:assets" {
  const assets: readonly string[];
  export default assets;
}

declare module "gameide:scenes" {
  const scenes: readonly string[];
  export default scenes;
}

interface ImportMetaHot {
  on(
    event: "gameide:scene-channel",
    callback: (message: unknown) => void,
  ): void;
}
