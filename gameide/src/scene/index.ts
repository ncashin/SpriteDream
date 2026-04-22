export type { SceneObject, SceneReflectUpdate } from "./scene.js";
export {
  sceneTarget,
  getScene,
  getRawScene,
  setScene,
  subscribeToScene,
  saveSceneSnapshot,
  restoreSceneSnapshot,
  applyPatch,
  findSceneReceiverPath,
  mergeSceneReflectUpdateIntoPatch,
} from "./scene.js";

export { getValueAtPath, setValueAtPath } from "./path.js";

export { merge } from "./merge.js";
export { sceneAdditions } from "./sceneAdditions/index.js";

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
