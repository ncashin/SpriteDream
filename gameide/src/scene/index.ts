export type { SceneObject, SceneUpdate } from "./scene.js";
export {
  deleteSceneAtPath,
  getRootTarget,
  getScene,
  getTarget,
  getValueAtPath,
  queryScene,
  replaceScene,
  restoreSceneSnapshot,
  saveSceneSnapshot,
  setInitialScene,
  setSceneAtPath,
  subscribeToSceneUpdates,
} from "./scene.js";

export type {
  QuerySceneCallback,
  QuerySceneCallbackOrGuard,
  QuerySceneOptions,
  QuerySceneTypeGuard,
  QueryResultEvent,
  QueryListeners,
  SceneQuery,
  SceneWithQuery,
} from "./queryScene.js";
export {
  createQueryListeners,
  getSceneQuery,
  querySceneObjects,
  subscribeToQuery,
} from "./queryScene.js";

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
  SceneChannelInMessage,
  SceneChannelOutMessage,
} from "./sceneChannel.js";

export type { ScenePatch } from "./scenePatch.js";
export { applyScenePatch, buildPatchFromDiff, pathToPatch } from "./scenePatch.js";

export type {
  PostMessageTransportOptions,
  SceneChannelTransport,
} from "./sceneChannelTransport.js";
export { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
