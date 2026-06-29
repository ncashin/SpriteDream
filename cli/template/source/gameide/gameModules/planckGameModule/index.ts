import "./colliderComponents.js";
import "./collisionBody.js";

export {
  getEffectivePlanckBodyType,
  getSceneBodyType,
  default as planckGameModule,
  sceneBodyIsDynamic,
  sceneBodyIsKinematic,
  sceneBodyIsStatic,
  type PlanckCollisionHandler,
  type PlanckCollisionInfo,
  type PlanckContactPhase,
  type PlanckGameModuleAPI,
  type PlanckGameModuleOptions,
  type PlanckGameObjectExtensions,
} from "./planckGameModule.js";
export { boxColliderTrait, circleColliderTrait } from "./colliderComponents.js";
export { collisionBodyTrait } from "./collisionBody.js";
export type { Rigidbody2D } from "./rigidbody2D.js";
