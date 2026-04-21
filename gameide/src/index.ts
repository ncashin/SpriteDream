export { createSceneTransportPostMessage as createPostMessageTransport } from "./scene/sceneChannel/sceneChannelTransport.js";
export type {
  SceneChannelTransport,
  PostMessageTransportOptions,
} from "./scene/sceneChannel/sceneChannelTransport.js";
export {
  createSceneChannel,
  SCENE_CHANNEL,
} from "./scene/sceneChannel/sceneChannel.js";
export type {
  CreateSceneChannelOptions,
  SceneChannel,
} from "./scene/sceneChannel/sceneChannel.js";

export {
  start,
  update,
  gameStart,
  gameUpdate,
  editorStart,
  editorUpdate,
  startGameloop,
} from "./lifecycle/gameloop.js";
export { query } from "./scene/query/query.js";
export {
  getScene,
  getRawScene,
  setScene,
  saveSceneSnapshot,
  restoreSceneSnapshot,
} from "./scene/scene.js";
export { getValueAtPath, setValueAtPath } from "./scene/path.js";
export { applyPatch as applyScenePatch } from "./scene/patch.js";
export type { SceneObject } from "./scene/scene.js";
export {
  trait,
  implementsTrait,
  createTraitGuard,
  getDefinedTraitsForEditor,
  $number,
  $string,
  $boolean,
} from "./trait/trait.js";
export type { TraitMetadata } from "./trait/trait.js";
export {
  game,
  plugins,
  type ApplyPlugins,
  type Plugin,
  type GameOptions,
  type GameConfig,
  type GameMain,
  type GameContext,
} from "./lifecycle/index.js";
export type { GameIDEMetadata } from "./meta/gameideManifest.js";
export { getGameIDEMetadata } from "./meta/gameideManifest.js";
export { editorPlugin } from "./editor/editorPlugin.js";
export type { EditorWithGameViewRef } from "./editor/createEditorUI.js";
export {
  networkingPlugin,
  SCENE_OWNER_ID,
  isOwnedSceneUpdate,
  isOwnedSceneObject,
  withOwnership,
} from "./networking/networkingPlugin.js";
export type { NetworkingPluginOptions } from "./networking/networkingPlugin.js";
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
export { GameIDEMode, getMode, setMode, onModeChange } from "./lifecycle/mode.js";
export { inputPlugin } from "./inputPlugin.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputPluginRequiredContext,
  InputPluginOptions,
} from "./inputPlugin.js";
