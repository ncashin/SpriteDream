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
  start,
  update,
  gameStart,
  gameUpdate,
  editorStart,
  editorUpdate,
  startGameloop,
  resetLifecycle,
  runStartsForCurrentMode,
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
export {
  applyPatch as applyScenePatch,
  buildScenePatchFromDiff,
} from "./scene/patch.js";
export type {
  BaseSceneObject,
  SceneObject,
  BaseSceneObject as SceneData,
  BaseSceneObject as ScenePatch,
} from "./scene/scene.js";
export {
  defineTrait,
  implementsTrait,
  createTraitGuard,
  getDefinedTraitsForEditor,
  $number,
  $string,
  $boolean,
} from "./trait/trait.js";
export type { TraitMetadata, DefinedTrait, TraitInputItem, TraitTupleToIntersection } from "./trait/trait.js";
export { transformTrait } from "./trait/transform.js";
export { gameObject } from "./trait/gameObject.js";
export type { GameObjectParts } from "./trait/gameObject.js";
export {
  game,
  plugins,
  dispose,
  type ApplyPlugins,
  type Plugin,
  type GameOptions,
  type GameConfig,
  type GameMain,
  type GameContext,
  type DisposeCallback,
} from "./lifecycle/index.js";
export { editorPlugin } from "./editorPlugin/editorPlugin.js";
export type { EditorWithGameViewReference } from "./editorPlugin/createEditorUI.js";
export {
  networkingPlugin,
  OWNER_ID,
  ownerTrait,
  isOwnedSceneUpdate,
  isOwnedSceneObject,
  withOwnership,
} from "./networking/networkingPlugin.js";
export { peerIntegratesPhysicsForObject } from "./networking/distributedSimulation.js";
export type { NetworkingApi, NetworkingPluginOptions } from "./networking/networkingPlugin.js";
export { gameUIPlugin } from "./gameUIPlugin/gameUIPlugin.js";
export { ExampleGameUI } from "./gameUIPlugin/ExampleGameUI.js";
export { Game } from "./gameUIPlugin/Game.js";
export { DefaultEditor } from "./editorPlugin/DefaultEditor.js";
export { EditorRoot } from "./editorPlugin/EditorRoot.js";
export { SceneTree } from "./editorPlugin/SceneTree.js";
export { Sidebar } from "./editorPlugin/Sidebar.js";
export { GameView } from "./editorPlugin/GameView.js";
export { OverlayButton } from "./editorPlugin/OverlayButton.js";
export { OverlayInput } from "./editorPlugin/OverlayInput.js";
export { useScene } from "./hooks/useScene.js";
export { useTraits } from "./hooks/useTraits.js";
export type { TraitTemplate } from "./hooks/useTraits.js";
export { useGameIDEMode } from "./hooks/useGameIDEMode.js";
export { GameIDEMode, getMode, setMode, onModeChange } from "./lifecycle/mode.js";
export { inputPlugin } from "./inputPlugin/inputPlugin.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputPluginRequiredContext,
  InputPluginOptions,
} from "./inputPlugin/inputPlugin.js";
export {
  pixiPlugin,
  type PixiPluginAPI,
  type PixiPluginOptions,
  type Viewport,
} from "./pixiPlugin/pixiPlugin.js";
export type { ColliderDebugOptions } from "./pixiPlugin/colliderDebug.js";
export {
  type ViewportState,
  applyViewportToWorldContainer,
} from "./pixiPlugin/viewport.js";
export { spriteTrait } from "./pixiPlugin/sprite.js";
export {
  planckPlugin,
  getSceneBodyType,
  getEffectivePlanckBodyType,
  sceneBodyIsStatic,
  sceneBodyIsKinematic,
  sceneBodyIsDynamic,
  type PlanckPluginAPI,
  type PlanckPluginOptions,
  type PlanckCallbackEvent,
  type PlanckCollisionHandler,
  type PlanckContactPhase,
} from "./planckPlugin/planckPlugin.js";
export type { Rigidbody2D } from "./planckPlugin/rigidbody2d.js";
export {
  boxColliderTrait,
  circleColliderTrait,

} from "./planckPlugin/colliderComponents.js";
export { collisionBodyTrait } from "./planckPlugin/collisionBody.js";
