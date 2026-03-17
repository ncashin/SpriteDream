export type { ScenePatch } from "./scenePatch.js";
export type { SceneData, SceneWebviewMessage } from "./sceneChannel.js";
export { applyScenePatch, pathToPatch, buildPatchFromDiff } from "./scenePatch.js";
export { createSceneTransportPostMessage as createPostMessageTransport } from "./sceneChannelTransport.js";
export type {
  SceneChannelTransport,
  PostMessageTransportOptions,
} from "./sceneChannelTransport.js";
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
  start,
  update,
  gameStart,
  gameUpdate,
  editorStart,
  editorUpdate,
  startGameloop,
} from "./gameloop.js";
export {
  getScene,
  setInitialScene,
  replaceScene,
  subscribeToSceneUpdates,
  getRootTarget,
  queryScene,
  getValueAtPath,
  setSceneAtPath,
  deleteSceneAtPath,
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
export { TransformDefinition as transform } from "./transform.js";
export { initializeGame } from "./initializeGame.js";
export type { Plugin, FinalContext } from "./initializeGame.js";
export { editorPlugin } from "./editor/editorPlugin.js";
export type { ScenePatchMessage } from "./editor/editorPlugin.js";
export { DefaultEditor } from "./editor/DefaultEditor.js";
export { EditorRoot } from "./editor/EditorRoot.js";
export { SceneTree } from "./editor/SceneTree.js";
export { Sidebar } from "./editor/Sidebar.js";
export { GameView } from "./editor/GameView.js";
export { OverlayButton } from "./editor/OverlayButton.js";
export { OverlayInput } from "./editor/OverlayInput.js";
export { useScene } from "./editor/useScene.js";
export { useGameIDEMode } from "./editor/useGameIDEMode.js";
export {
  GameIDEMode,
  getMode,
  setMode,
  onModeChange,
} from "./mode.js";
export { renderPlugin2D } from "./renderPlugin2D.js";
export type {
  Render2DPluginRequiredContext,
  Render2DPluginOptions,
} from "./renderPlugin2D.js";
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
export { SCENE_HMR_EVENT_NAME } from "./sceneHMR.js";
export type { SceneHMRPayload } from "./sceneHMR.js";
