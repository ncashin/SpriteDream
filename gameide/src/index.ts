export type { ScenePatch } from "./scenePatch.js";
export type { SceneData, SceneWebviewMessage } from "./sceneChannel.js";
export { applyScenePatch, pathToPatch, buildPatchFromDiff } from "./scenePatch.js";
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
  queryScene,
  getValueAtPath,
} from "./scene.js";
export type { SceneObject, SceneUpdate } from "./scene.js";
export {
  querySceneObjects,
  subscribeToQuery,
  getSceneQuery,
  createQueryListeners,
} from "./queryScene.js";
export type {
  QuerySceneCallback,
  QuerySceneTypeGuard,
  QuerySceneOptions,
  QueryResultEvent,
  SceneQuery,
  QueryListeners,
  SceneWithQuery,
} from "./queryScene.js";
export {
  defineObject,
  getDefinedObjectsForEditor,
  $number,
  $string,
  $boolean,
} from "./objectRegistry.js";
export type { SchemaToType, DefinedObject, ObjectMetadata } from "./objectRegistry.js";
export { initializeGame } from "./initializeGame.js";
export type { Plugin, FinalContext } from "./initializeGame.js";
export { editorPlugin } from "./editorPlugin.js";
export type { ScenePatchMessage } from "./editorPlugin.js";
export {
  GameIDEMode,
  getMode,
  setMode,
  onModeChange,
} from "./mode.js";
export { render2DPlugin } from "./render2DPlugin.js";
export type {
  Render2DPluginRequiredContext,
  Render2DPluginOptions,
} from "./render2DPlugin.js";
export { inputPlugin } from "./inputPlugin.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputPluginRequiredContext,
  InputPluginOptions,
  InputContext,
  ExtractAxisKeys,
  ExtractButtonKeys,
} from "./inputPlugin.js";
export { gameidePlugin } from "./gameidePluginVite.js";
