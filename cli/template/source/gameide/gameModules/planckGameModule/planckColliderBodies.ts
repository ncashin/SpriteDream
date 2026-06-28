import type { BodyType, World } from "planck";
import { type GameObject, type Scene } from "gameide";
import {
  colliderSignature,
  createBodyForObject,
  qualifiesForPlanckBody,
  syncBodyTransformFromObject,
  type PlanckRecord,
} from "./planckBodies.js";


export function planckColliderBodies(args: {
  scene: Scene;
  world: World;
  pixelsPerMeter: number;
  effectiveType: (object: GameObject) => BodyType;
}): {
  unsubscribe: () => void;
  sceneKeyToPlanckRecord: Map<PropertyKey, PlanckRecord>;
} {
  const { scene } = args;
  const sceneKeyToPlanckRecord = new Map<PropertyKey, PlanckRecord>();

  const reconcileSceneRootKey = (
    sceneRootKey: PropertyKey,
    mutationPathTrail: PropertyKey[] = [],
  ): void => {
    const maybeLiveNode = Reflect.get(scene.get(), sceneRootKey);

    const removeIfPresent = () => {
      const prevRecord = sceneKeyToPlanckRecord.get(sceneRootKey);
      if (prevRecord) {
        args.world.destroyBody(prevRecord.body);
        sceneKeyToPlanckRecord.delete(sceneRootKey);
      }
    };

    const qualifiesCollider =
      maybeLiveNode !== undefined && qualifiesForPlanckBody(maybeLiveNode);
    if (!qualifiesCollider) {
      removeIfPresent();
      return;
    }

    const sceneObject = maybeLiveNode as GameObject;
    const effectiveBodyType = args.effectiveType(sceneObject);
    const nextColliderSignatureValue = colliderSignature(sceneObject, effectiveBodyType);
    if (!nextColliderSignatureValue) {
      removeIfPresent();
      return;
    }

    const existingPlanckRecord = sceneKeyToPlanckRecord.get(sceneRootKey);
    if (
      existingPlanckRecord?.signature === nextColliderSignatureValue &&
      existingPlanckRecord.body.getType() === effectiveBodyType
    ) {
      const isRootReplace = mutationPathTrail.length <= 1;
      const touchesPose = mutationPathTrail.some(
        (segment) => segment === "position" || segment === "rotation" || segment === "scale",
      );
      const shouldSyncPoseFromScene =
        effectiveBodyType !== "dynamic" || isRootReplace || touchesPose;
      if (!shouldSyncPoseFromScene) return;

      syncBodyTransformFromObject(
        existingPlanckRecord.body,
        sceneObject,
        args.pixelsPerMeter,
      );
      return;
    }

    if (existingPlanckRecord) {
      args.world.destroyBody(existingPlanckRecord.body);
      sceneKeyToPlanckRecord.delete(sceneRootKey);
    }

    const createdPlanckRecord = createBodyForObject(
      args.world,
      sceneObject,
      effectiveBodyType,
      args.pixelsPerMeter,
      sceneRootKey,
    );
    if (createdPlanckRecord) {
      sceneKeyToPlanckRecord.set(sceneRootKey, createdPlanckRecord);
    }
  };

  for (const initialOwnedSceneIdentifier of Reflect.ownKeys(scene.getRaw())) {
    reconcileSceneRootKey(initialOwnedSceneIdentifier);
  }

  const unsubscribe = scene.onChange((_mutationTarget, mutationPathTrail) => {
    const anchoredSceneRootIdentifier = mutationPathTrail[0];
    if (anchoredSceneRootIdentifier === undefined) return;
    reconcileSceneRootKey(anchoredSceneRootIdentifier, mutationPathTrail);
  });

  return { unsubscribe, sceneKeyToPlanckRecord };
}
