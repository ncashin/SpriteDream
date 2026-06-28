import "./colliderComponents.js";
import "./collisionBody.js";

export {
  getEffectivePlanckBodyType,
  getSceneBodyType,
  planckGameModule,
  sceneBodyIsDynamic,
  sceneBodyIsKinematic,
  sceneBodyIsStatic,
  type PlanckCollisionHandler,
  type PlanckCollisionInfo,
  type PlanckContactPhase,
  type PlanckGameModuleAPI,
  type PlanckGameModuleOptions,
} from "./planckGameModule.js";
export { boxColliderTrait, circleColliderTrait } from "./colliderComponents.js";
export { collisionBodyTrait } from "./collisionBody.js";
export type { Rigidbody2D } from "./rigidbody2D.js";
