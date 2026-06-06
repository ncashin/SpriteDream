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
  SceneChannelMessage,
  SceneEditorState,
} from "./scene/sceneChannel/sceneChannel.js";

export {
  start,
  update,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  startGameloop,
  dispose,
  __beginHotModule,
  __endHotModule,
  __disposeHotModule,
  __runHotModuleReplay,
  __hotModuleDefaultExport,
  __hotModuleLastArgsForScope,
} from "./lifecycle/gameloop.js";
export {
  curryScene,
  getScene,
  getRawScene,
  setScene,
  SCENE_PATCH_DELETED,
  isScenePatchDeletion,
  stripScenePatchSentinels,
} from "./scene/scene.js";
export {
  selectedObject,
  selectObject,
  deselectObject,
} from "./scene/objectSelection.js";
export {
  deleteValueAtPath,
  getValueAtPath,
  renameKeyAtPath,
  setValueAtPath,
} from "./scene/path.js";

export type { Scene, SceneObject, GameObject, ScenePath } from "./scene/scene.js";
export {
  defineTrait,
  implementsTrait,
  getTraitDefinitions,
  type TraitIntersection,
} from "./trait/trait.js";
export {
  gameide,
  getGameContext,
  plugins,
  type ApplyPlugins,
  type Plugin,
  type GameConfig,
  type GameContext,
  type DisposeCallback,
  type GameAPI,
} from "./lifecycle/index.js";
export { editorPlugin } from "./plugins/editorPlugin/editorPlugin.js";
export type { EditorWithGameViewReference } from "./plugins/editorPlugin/createEditorUI.js";
export {
  networkingPlugin,
  OWNER_ID,
  ownerTrait,
  isOwnedSceneUpdate,
  isOwnedSceneObject,
  withOwnership,
} from "./plugins/networkingPlugin/networkingPlugin.js";
export { peerIntegratesPhysicsForObject } from "./plugins/networkingPlugin/distributedSimulation.js";
export type { NetworkingAPI as NetworkingApi, NetworkingPluginOptions } from "./plugins/networkingPlugin/networkingPlugin.js";
export { gameUIPlugin } from "./plugins/gameUIPlugin/gameUIPlugin.js";
export { Game } from "./plugins/gameUIPlugin/Game.js";
export { EditorRoot } from "./plugins/editorPlugin/EditorRoot.js";
export { GameView } from "./plugins/editorPlugin/GameView.js";
export { useScene } from "./hooks/useScene.js";
export { useSceneFile } from "./plugins/editorPlugin/sceneFile/useSceneFile.js";
export {
  useSceneFileStore,
  hydrateSceneFileStore,
} from "./plugins/editorPlugin/sceneFile/sceneFileStore.js";
export { useSelectedObject } from "./hooks/useSelectedObject.js";
export { useTraits } from "./hooks/useTraits.js";
export { useGameIDEMode } from "./hooks/useGameIDEMode.js";
export { GameIDEMode, getMode, setMode, onModeChange } from "./lifecycle/mode.js";
export { inputPlugin } from "./plugins/inputPlugin/inputPlugin.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputMouseHandling,
  InputPluginRequiredContext,
  InputPluginOptions,
} from "./plugins/inputPlugin/inputPlugin.js";
