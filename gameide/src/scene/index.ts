export type { SceneObject, SceneObjectData, SceneUpdate } from "./scene.js";
export { queryObject, querySubtree } from "./query.js";
export {
  getSceneRaw,
  getScene,
  getSceneObjectPath,
  getSceneValueAtPath,
  restoreSceneSnapshot,
  saveSceneSnapshot,
  setScene,
  onSceneUpdate,
  applyScenePatchToRootTarget,
} from "./scene.js";

export { SCENE_HMR_EVENT_NAME } from "./sceneHMR.js";
export type { SceneHMRPayload } from "./sceneHMR.js";

export type { SceneData, SceneWebviewMessage } from "./sceneChannel.js";
export {
  createSceneChannel,
  SCENE_CHANNEL,
  SCENE_MESSAGE_TYPES,
} from "./sceneChannel.js";
export type {
  CreateSceneChannelOptions,
  SceneChannel,
} from "./sceneChannel.js";

export type { ScenePath } from "./scenePath.js";
export {
  appendKeyToPath,
  getPathKey,
  getValueAtPath,
  isPathPrefixOf,
  pathUpdateAffectsPath,
  pathsEqual,
  pathsSharePrefix,
  setValueAtPath,
} from "./scenePath.js";

export type { ScenePatch } from "./scenePatch.js";
export {
  applyScenePatchesInOrder,
  applyScenePatch,
  buildScenePatchFromDiff,
  patchAtPath,
} from "./scenePatch.js";

export type {
  PostMessageTransportOptions,
  SceneChannelTransport,
} from "./sceneChannelTransport.js";
export { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
