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
} from "./scene/sceneChannel/sceneChannel.js";

export {
  onStart,
  onUpdate,
  onGameStart,
  onGameUpdate,
  onEditorStart,
  onEditorUpdate,
  startGameloop,
  onDispose,
  type DisposeCallback,
} from "./lifecycle/gameloop.js";
export {
  curryScene,
  SCENE_PATCH_DELETED,
  isScenePatchDeletion,
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
  gameModule,
  curriedGameModule,
  rerunGameModule,
  rerunCurriedGameModule,
  rerunReduceFrom,
  trackGameModuleDispose,
  type ApplyGameModules,
  type GameModule,
  type GameIDEOptions,
  type BaseGameContext,
  type GameContext,
  type GameLifecycle,
} from "./lifecycle/index.js";
export { default as editorGameModule } from "./gameModules/editorGameModule/editorGameModule.js";
export type { Editor } from "./gameModules/editorGameModule/createEditorUI.js";
export {
  default as networkingGameModule,
  OWNER_ID,
  ownerTrait,
  isOwnedSceneUpdate,
  isOwnedSceneObject,
  withOwnership,
} from "./gameModules/networkingGameModule/networkingGameModule.js";
export { peerIntegratesPhysicsForObject } from "./gameModules/networkingGameModule/distributedSimulation.js";
export type { NetworkingAPI as NetworkingApi, NetworkingGameModuleOptions } from "./gameModules/networkingGameModule/networkingGameModule.js";
export { default as gameUIGameModule } from "./gameModules/gameUIGameModule/gameUIGameModule.js";
export { Game } from "./gameModules/gameUIGameModule/Game.js";
export { EditorRoot } from "./gameModules/editorGameModule/EditorRoot.js";
export { GameView } from "./gameModules/editorGameModule/GameView.js";
export { useScene } from "./scene/sceneContext.js";
export { useSceneObject } from "./hooks/useSceneObject.js";
export { useSceneFile } from "./gameModules/editorGameModule/sceneFile/useSceneFile.js";
export { useSceneHistory } from "./gameModules/editorGameModule/sceneFile/useSceneHistory.js";
export {
  useSceneFileStore,
} from "./gameModules/editorGameModule/sceneFile/sceneFileStore.js";
export { useSceneHistoryStore } from "./gameModules/editorGameModule/sceneFile/sceneHistoryStore.js";
export { useSelectedSceneObject } from "./hooks/useSelectedSceneObject.js";
export { useTraits } from "./hooks/useTraits.js";
export { useGameIDEMode } from "./hooks/useGameIDEMode.js";
export { useEditorDebugUI } from "./hooks/useEditorDebugUI.js";
export {
  getVirtualCatalog,
  getVirtualCatalogs,
  loadVirtualCatalogs,
  subscribeVirtualCatalogs,
  type VirtualCatalogId,
  type VirtualCatalogs,
} from "./virtualCatalogStore.js";
export {
  getEditorDebugUIEnabled,
  setEditorDebugUIEnabled,
  toggleEditorDebugUI,
  onEditorDebugUIChange,
} from "./gameModules/editorGameModule/editorDebugUI.js";
export { GameIDEMode, getMode, setMode, onModeChange } from "./lifecycle/mode.js";
export { ASSET_BASE_URL } from "./assetBaseURL.js";
export { default as inputGameModule } from "./gameModules/inputGameModule/inputGameModule.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputMouseHandling,
  InputGameModuleRequiredContext,
  InputGameModuleOptions,
} from "./gameModules/inputGameModule/inputGameModule.js";
