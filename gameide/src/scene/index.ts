export type {
  GameObject,
  SceneObject,
  ScenePath,
  SceneListener,
} from "./scene.js";
export {
  selectObject,
  deselectObject,
} from "./objectSelection.js";
export {
  createSceneProxy,
  curryScene,
  getRawScene,
  getScene,
  setScene,
} from "./scene.js";

export {
  deleteValueAtPath,
  getValueAtPath,
  renameKeyAtPath,
  setValueAtPath,
} from "./path.js";

export type { SceneChannelMessage } from "./sceneChannel/sceneChannel.js";
export {
  createSceneChannel,
  SCENE_CHANNEL,
} from "./sceneChannel/sceneChannel.js";
export type {
  CreateSceneChannelOptions,
  SceneChannel,
} from "./sceneChannel/sceneChannel.js";

export type {
  PostMessageTransportOptions,
  SceneChannelTransport,
} from "./sceneChannel/sceneChannelTransport.js";
export { createSceneTransportPostMessage } from "./sceneChannel/sceneChannelTransport.js";
