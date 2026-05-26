/// <reference types="vite/client" />

declare module "*.scene" {
  const scene: import("gameide").SceneObject;
  export default scene;
}
