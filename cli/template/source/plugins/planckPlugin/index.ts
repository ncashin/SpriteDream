import "./colliderComponents.js";
import "./collisionBody.js";

export {
  getEffectivePlanckBodyType,
  getSceneBodyType,
  planckPlugin,
  sceneBodyIsDynamic,
  sceneBodyIsKinematic,
  sceneBodyIsStatic,
  type PlanckCollisionHandler,
  type PlanckCollisionInfo,
  type PlanckContactPhase,
  type PlanckPluginAPI,
  type PlanckPluginOptions,
} from "./planckPlugin.js";
export { boxColliderTrait, circleColliderTrait } from "./colliderComponents.js";
export { collisionBodyTrait } from "./collisionBody.js";
export type { Rigidbody2D } from "./rigidbody2D.js";
