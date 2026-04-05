export type { ScenePatch } from "./scene/scenePatch.js";
export type { SceneData, SceneWebviewMessage } from "./scene/sceneChannel.js";
export {
  applyScenePatchesInOrder,
  applyScenePatch,
  buildScenePatchFromDiff,
  patchAtPath,
} from "./scene/scenePatch.js";
export { createSceneTransportPostMessage as createPostMessageTransport } from "./scene/sceneChannelTransport.js";
export type {
  SceneChannelTransport,
  PostMessageTransportOptions,
} from "./scene/sceneChannelTransport.js";
export {
  createSceneChannel,
  SCENE_CHANNEL,
  SCENE_MESSAGE_TYPES,
} from "./scene/sceneChannel.js";
export type {
  CreateSceneChannelOptions,
  SceneChannel,
  SceneChannelInMessage,
  SceneChannelOutMessage,
} from "./scene/sceneChannel.js";

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
  setScene,
  saveSceneSnapshot,
  restoreSceneSnapshot,
  onSceneChange,
  getSceneRaw,
  getSceneValueAtPath,
} from "./scene/scene.js";
export type { SceneObject, SceneUpdate } from "./scene/scene.js";
export type { ScenePath } from "./scene/scenePath.js";
export {
  appendKeyToPath,
  getPathKey,
  getValueAtPath,
  isPathPrefixOf,
  pathUpdateAffectsPath,
  pathsEqual,
  pathsSharePrefix,
  setValueAtPathInObject,
} from "./scene/scenePath.js";
export {
  querySceneObjects,
  subscribeToQuery,
  getSceneQuery,
  createQueryListeners,
} from "./scene/queryScene.js";
export type {
  QuerySceneCallback,
  QuerySceneTypeGuard,
  QuerySceneOptions,
  QueryResultEvent,
  SceneQuery,
  QueryListeners,
  SceneWithQuery,
} from "./scene/queryScene.js";
export {
  defineObject,
  createObjectGuard,
  getDefinedObjectsForEditor,
  $number,
  $string,
  $boolean,
} from "./objectRegistry.js";
export type { SchemaToType, ObjectMetadata } from "./objectRegistry.js";
export { SpriteDefinition } from "./renderPlugin2D/sprite.js";
export { TransformDefinition2D } from "./renderPlugin2D/transform.js";
export {
  initializeGame,
  initializePlugins,
} from "./initializeGame.js";
export type { Plugin, FinalContext } from "./initializeGame.js";
export { editorPlugin } from "./editor/editorPlugin.js";
export type { ScenePatchMessage } from "./editor/editorPlugin.js";
export { gameUIPlugin } from "./editor/gameUIPlugin/gameUIPlugin.js";
export { ExampleGameUI } from "./editor/gameUIPlugin/ExampleGameUI.js";
export { Game } from "./editor/gameUIPlugin/Game.js";
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
export { renderPlugin2D } from "./renderPlugin2D/renderPlugin2D.js";
export type {
  Render2DPluginRequiredContext,
  Render2DPluginOptions,
} from "./renderPlugin2D/renderPlugin2D.js";
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
export { SCENE_HMR_EVENT_NAME } from "./scene/sceneHMR.js";
export type { SceneHMRPayload } from "./scene/sceneHMR.js";
