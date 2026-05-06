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
  logLifecycleRegistries,
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
  gameide,
  plugins,
  dispose,
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
export type { NetworkingApi, NetworkingPluginOptions } from "./plugins/networkingPlugin/networkingPlugin.js";
export { gameUIPlugin } from "./plugins/gameUIPlugin/gameUIPlugin.js";
export { ExampleGameUI } from "./plugins/gameUIPlugin/ExampleGameUI.js";
export { Game } from "./plugins/gameUIPlugin/Game.js";
export { DefaultEditor } from "./plugins/editorPlugin/DefaultEditor.js";
export { EditorRoot } from "./plugins/editorPlugin/EditorRoot.js";
export { SceneTree } from "./plugins/editorPlugin/SceneTree.js";
export { Sidebar } from "./plugins/editorPlugin/Sidebar.js";
export { GameView } from "./plugins/editorPlugin/GameView.js";
export { OverlayButton } from "./plugins/editorPlugin/OverlayButton.js";
export { OverlayInput } from "./plugins/editorPlugin/OverlayInput.js";
export { useScene } from "./hooks/useScene.js";
export { useTraits } from "./hooks/useTraits.js";
export type { TraitTemplate } from "./hooks/useTraits.js";
export { useGameIDEMode } from "./hooks/useGameIDEMode.js";
export { GameIDEMode, getMode, setMode, onModeChange } from "./lifecycle/mode.js";
export { inputPlugin } from "./plugins/inputPlugin/inputPlugin.js";
export type {
  InputBinding,
  AxisConfig,
  ButtonConfig,
  InputPluginRequiredContext,
  InputPluginOptions,
} from "./plugins/inputPlugin/inputPlugin.js";
export {
  pixiPlugin,
  type PixiPluginAPI,
  type PixiPluginOptions,
  type Viewport,
} from "./plugins/pixiPlugin/pixiPlugin.js";
export type { ColliderDebugOptions } from "./plugins/pixiPlugin/colliderDebug.js";
export {
  type ViewportState,
  applyViewportToWorldContainer,
} from "./plugins/pixiPlugin/viewport.js";
export { spriteTrait } from "./plugins/pixiPlugin/sprite.js";
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
} from "./plugins/planckPlugin/planckPlugin.js";
export type { Rigidbody2D } from "./plugins/planckPlugin/rigidbody2d.js";
export {
  boxColliderTrait,
  circleColliderTrait,

} from "./plugins/planckPlugin/colliderComponents.js";
export { collisionBodyTrait } from "./plugins/planckPlugin/collisionBody.js";
