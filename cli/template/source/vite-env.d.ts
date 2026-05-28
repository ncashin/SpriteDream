/// <reference types="vite/client" />
/// <reference types="gameide/vite/client" />

declare module "*.scene" {
  const scene: import("gameide").SceneObject;
  export default scene;
}
