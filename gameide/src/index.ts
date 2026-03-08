export type { ScenePatch } from "./scenePatch.js";
export type { SceneData, SceneWebviewMessage } from "./sceneChannel.js";
export { applyScenePatch, pathToPatch } from "./scenePatch.js";
export { createSceneTransportPostMessage as createPostMessageTransport } from "./sceneChannelTransport.js";
  export type { SceneChannelTransport, PostMessageTransportOptions } from "./sceneChannelTransport.js";
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

export { definePlugin } from "./plugin.js";
export {
  gameStart,
  gameUpdate,
  editorStart,
  editorUpdate,
  startGameloop,
  setUpdateScope,
  clearUpdateScope,
  removeGameUpdatesForScope,
} from "./gameloop.js";
export {
  getScene,
  setInitialScene,
  replaceScene,
  subscribeToSceneUpdates,
  getRootTarget,
} from "./scene.js";
export type { SceneUpdate } from "./scene.js";
export { initializeGame } from "./initializeGame.js";
export type {
  Plugin,
  FinalContext,
  InitializeGameOptions,
} from "./initializeGame.js";
export { editorPlugin } from "./editorPlugin.js";
export type { ScenePatchMessage } from "./editorPlugin.js";
export { render2DPlugin } from "./render2DPlugin.js";
export type {
  Render2DPluginRequiredContext,
  Render2DPluginOptions,
  Render2DContext,
} from "./render2DPlugin.js";
export { inputPlugin } from "./inputPlugin.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputPluginRequiredContext,
  InputPluginOptions,
  InputContext,
} from "./inputPlugin.js";
